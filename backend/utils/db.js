const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          tls: redisUrl.startsWith('rediss://'),
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis max retry attempts reached');
              return new Error('Max retry attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
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
      this._startCleanupInterval();
      return this.client;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  _startCleanupInterval() {
    setInterval(async () => {
      try {
        // Redis TTL handles expiry natively — placeholder for future tasks
      } catch (err) {
        console.error('Background cleanup error:', err);
      }
    }, 60000).unref?.();
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

  async removeMember(roomId, clientId) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    await client.sRem(key, clientId);
    return await client.sCard(key); // returns remaining count
  }

  async getMemberCount(roomId) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    return await client.sCard(key);
  }

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
    await client.setEx(messageKey, ttl, JSON.stringify(message));
    const roomMessagesKey = `room:${roomId}:messages`;
    await client.lPush(roomMessagesKey, messageId);
    await client.expire(roomMessagesKey, ttl);
    return message;
  }

  async getMessages(roomId) {
    const client = this.getClient();
    const roomMessagesKey = `room:${roomId}:messages`;
    const messageIds = await client.lRange(roomMessagesKey, 0, -1);
    if (!messageIds.length) return [];
    // Use MGET for a single round-trip instead of N individual GETs
    const messageKeys = messageIds.map(id => `message:${id}`);
    const rawMessages = await client.mGet(messageKeys);
    const messages = rawMessages
      .filter(Boolean)
      .map(raw => JSON.parse(raw));
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

const redisClient = new RedisClient();
module.exports = redisClient;
