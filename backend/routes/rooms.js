const express = require('express');
const { v4: uuidv4 } = require('uuid');
const redisClient = require('../utils/db');
const { validateRoom, validateJoinRoom, validateInvite } = require('../middleware/validation');

const router = express.Router();

// POST /api/rooms - Create a new room
router.post('/', validateRoom, async (req, res) => {
  try {
    const { ttl = 3600, pin, maxMembers, roomTtlMs } = req.body; // Default 1 hour room TTL
    
    // Generate unique room ID
    const roomId = uuidv4();
    
    // Create room in Redis
    const meta = {};
    if (maxMembers) meta.maxMembers = parseInt(maxMembers, 10);
    if (roomTtlMs) meta.roomTtlMs = parseInt(roomTtlMs, 10);
    if (pin) {
      // simple SHA-256 hash (bcrypt would need extra dep); adequate for demo PIN
      const crypto = require('crypto');
      meta.pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
    }
    await redisClient.createRoom(roomId, ttl, meta);
    
    console.log(`✅ Room created: ${roomId}`);
    
    res.status(201).json({
      success: true,
      roomId,
      ttl,
      message: 'Room created successfully',
      maxMembers: meta.maxMembers || null,
      roomTtlMs: meta.roomTtlMs || null,
      hasPin: Boolean(meta.pinHash)
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create room'
    });
  }
});

// GET /api/rooms/:id - Check if room exists
router.get('/:id', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    
    const room = await redisClient.getRoom(roomId);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      room: {
        id: room.id,
        createdAt: room.createdAt,
        expiresAt: room.expiresAt,
        hasPin: Boolean(room.pinHash),
        maxMembers: room.maxMembers || null
      }
    });
  } catch (error) {
    console.error('Error checking room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check room'
    });
  }
});

// POST /api/rooms/:id/join - Join a room with optional PIN and invite token (stateless)
router.post('/:id/join', validateJoinRoom, async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { pin, clientId, invite } = req.body || {};
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    // Validate PIN if set
    if (room.pinHash) {
      const crypto = require('crypto');
      const pinHash = crypto.createHash('sha256').update(String(pin || '')).digest('hex');
      if (pinHash !== room.pinHash) return res.status(403).json({ success: false, error: 'Invalid PIN' });
    }

    // Validate invite if provided (stateless JWT via HMAC)
    if (invite) {
      const token = String(invite);
      const verify = (tokenStr, secret) => {
        try {
          const [h, p, s] = tokenStr.split('.');
          const data = `${h}.${p}`;
          const expected = require('crypto').createHmac('sha256', secret).update(data).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
          if (expected !== s) return null;
          const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
          if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
          return payload;
        } catch { return null; }
      };
      const payload = verify(token, process.env.INVITE_SECRET || 'dev-invite');
      if (!payload || payload.roomId !== roomId || payload.scope !== 'join') {
        return res.status(403).json({ success: false, error: 'Invalid invite' });
      }
    }

    // Member cap
    const cur = await redisClient.getMemberCount(roomId);
    if (room.maxMembers && cur >= room.maxMembers) {
      return res.status(403).json({ success: false, error: 'Room member limit reached' });
    }
    const ttlSeconds = Math.max(1, Math.floor((new Date(room.expiresAt) - new Date()) / 1000));
    await redisClient.addMember(roomId, clientId || `guest:${Date.now()}`, ttlSeconds);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ success: false, error: 'Failed to join room' });
  }
});

// POST /api/rooms/:id/invite - issue stateless invite JWT
router.post('/:id/invite', validateInvite, async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { ttlSeconds = 1800 } = req.body || {};
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    const now = Math.floor(Date.now()/1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const payload = Buffer.from(JSON.stringify({ roomId, scope: 'join', iat: now, exp: now + Math.min(ttlSeconds, 24*3600) })).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    const data = `${header}.${payload}`;
    const sig = require('crypto').createHmac('sha256', process.env.INVITE_SECRET || 'dev-invite').update(data).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    return res.json({ success: true, token: `${data}.${sig}` });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ success: false, error: 'Failed to create invite' });
  }
});

// DELETE /api/rooms/:id - Delete a room (optional endpoint)
router.delete('/:id', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    
    const client = redisClient.getClient();
    const roomKey = `room:${roomId}`;
    const roomMessagesKey = `room:${roomId}:messages`;
    
    // Delete room and all its messages
    await client.del(roomKey);
    await client.del(roomMessagesKey);
    
    console.log(`🗑️ Room deleted: ${roomId}`);
    
    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete room'
    });
  }
});

module.exports = router;
