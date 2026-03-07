const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => {
          if (times > 10) {
            console.error('Redis max retry attempts reached');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      await new Promise((resolve, reject) => {
        this.client.once('ready', () => {
          console.log('✅ Connected to Redis');
          console.log('✅ Redis client ready');
          this.isConnected = true;
          resolve();
        });
        this.client.once('error', (err) => {
          reject(err);
        });
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('❌ Redis connection ended');
        this.isConnected = false;
      });

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
        // Redis TTL handles expiry natively
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
    await client.setex(`room:${roomId}`, ttl, JSON.stringify({
      id: roomId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      ...meta
    }));
    return roomId;
  }

  async getRoom(roomId) {
    const client = this.getClient();
    const data = await client.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  }

  async roomExists(roomId) {
    return await this.getClient().exists(`room:${roomId}`);
  }

  async setRoom(roomId, roomObj, ttlSeconds) {
    const client = this.getClient();
    await client.set(`room:${roomId}`, JSON.stringify(roomObj));
    if (ttlSeconds) await client.expire(`room:${roomId}`, ttlSeconds);
  }

  async addMember(roomId, clientId, roomTtlSeconds) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    await client.sadd(key, clientId);
    if (roomTtlSeconds) await client.expire(key, roomTtlSeconds);
    return await client.scard(key);
  }

  async removeMember(roomId, clientId) {
    const client = this.getClient();
    const key = `room:${roomId}:members`;
    await client.srem(key, clientId);
    return await client.scard(key);
  }

  async getMemberCount(roomId) {
    return await this.getClient().scard(`room:${roomId}:members`);
  }

  async addMessage(roomId, messageData, ttl = 300) {
    const client = this.getClient();
    const messageId = `msg:${roomId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: messageId,
      roomId,
      ...messageData,
      timestamp: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };
    await client.setex(`message:${messageId}`, ttl, JSON.stringify(message));
    const roomMessagesKey = `room:${roomId}:messages`;
    await client.lpush(roomMessagesKey, messageId);
    await client.expire(roomMessagesKey, ttl);
    return message;
  }

  async getMessages(roomId) {
    const client = this.getClient();
    const roomMessagesKey = `room:${roomId}:messages`;
    const messageIds = await client.lrange(roomMessagesKey, 0, -1);
    if (!messageIds.length) return [];
    const rawMessages = await client.mget(...messageIds.map(id => `message:${id}`));
    return rawMessages
      .filter(Boolean)
      .map(raw => JSON.parse(raw))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  async deleteMessage(messageId) {
    await this.getClient().del(`message:${messageId}`);
  }

  async cleanupExpiredMessages(roomId) {
    const client = this.getClient();
    const roomMessagesKey = `room:${roomId}:messages`;
    const messageIds = await client.lrange(roomMessagesKey, 0, -1);
    for (const messageId of messageIds) {
      const exists = await client.exists(`message:${messageId}`);
      if (!exists) await client.lrem(roomMessagesKey, 1, messageId);
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
