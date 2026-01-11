const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
      });

      this.client.on('end', () => {
        console.log('❌ Redis connection ended');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  getClient() {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  // Room operations
  async createRoom(roomId, ttl = 3600, meta = {}) {
    const client = this.getClient();
    const roomKey = `room:${roomId}`;
    await client.setEx(roomKey, ttl, JSON.stringify({
      id: roomId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      ...meta
    }));
    return roomId;
  }

  async getRoom(roomId) {
    const client = this.getClient();
    const roomKey = `room:${roomId}`;
    const roomData = await client.get(roomKey);
    return roomData ? JSON.parse(roomData) : null;
  }

  async roomExists(roomId) {
    const client = this.getClient();
    const roomKey = `room:${roomId}`;
    return await client.exists(roomKey);
  }

  async setRoom(roomId, roomObj, ttlSeconds) {
    const client = this.getClient();
    const roomKey = `room:${roomId}`;
    await client.set(roomKey, JSON.stringify(roomObj));
    if (ttlSeconds) await client.expire(roomKey, ttlSeconds);
  }

  async addMember(roomId, clientId, roomTtlSeconds) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    await client.sAdd(key, clientId);
    if (roomTtlSeconds) await client.expire(key, roomTtlSeconds);
    return await client.sCard(key);
  }

  async getMemberCount(roomId) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    return await client.sCard(key);
  }

  // Message operations
  async addMessage(roomId, messageData, ttl = 300) {
    const client = this.getClient();
    const messageId = `msg:${roomId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const messageKey = `message:${messageId}`;
    
    const message = {
      id: messageId,
      roomId,
      ...messageData,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };

    // Store message with TTL
    await client.setEx(messageKey, ttl, JSON.stringify(message));
    
    // Add to room's message list (also with TTL)
    const roomMessagesKey = `room:${roomId}:messages`;
    await client.lPush(roomMessagesKey, messageId);
    await client.expire(roomMessagesKey, ttl);
    
    return message;
  }

  async getMessages(roomId) {
    const client = this.getClient();
    const roomMessagesKey = `room:${roomId}:messages`;
    const messageIds = await client.lRange(roomMessagesKey, 0, -1);
    
    const messages = [];
    for (const messageId of messageIds) {
      const messageKey = `message:${messageId}`;
      const messageData = await client.get(messageKey);
      if (messageData) {
        messages.push(JSON.parse(messageData));
      }
    }
    
    // Sort by timestamp (oldest first) for chat-style ordering
    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async deleteMessage(messageId) {
    const client = this.getClient();
    const messageKey = `message:${messageId}`;
    await client.del(messageKey);
  }

  async cleanupExpiredMessages(roomId) {
    const client = this.getClient();
    const roomMessagesKey = `room:${roomId}:messages`;
    const messageIds = await client.lRange(roomMessagesKey, 0, -1);
    
    for (const messageId of messageIds) {
      const messageKey = `message:${messageId}`;
      const exists = await client.exists(messageKey);
      if (!exists) {
        await client.lRem(roomMessagesKey, 1, messageId);
      }
    }
  }
}

// Create singleton instance
const redisClient = new RedisClient();

module.exports = redisClient;
