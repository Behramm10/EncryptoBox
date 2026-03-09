const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const redisClient = require('../utils/db');
const { validateRoom, validateJoinRoom, validateInvite } = require('../middleware/validation');

const router = express.Router();

if (process.env.NODE_ENV === 'production' && (!process.env.INVITE_SECRET || process.env.INVITE_SECRET === 'dev-invite')) {
  console.error('🚨 CRITICAL: INVITE_SECRET is using the insecure default value in production!');
  process.exit(1);
}

router.post('/', validateRoom, async (req, res) => {
  try {
    const { ttl = 3600, pin, maxMembers, roomTtlMs } = req.body;
    const roomId = uuidv4();
    const meta = {};
    if (maxMembers) meta.maxMembers = parseInt(maxMembers, 10);
    if (roomTtlMs) meta.roomTtlMs = parseInt(roomTtlMs, 10);
    if (pin) {
      const salt = bcrypt.genSaltSync(10);
      meta.pinHash = bcrypt.hashSync(String(pin), salt);
    }
    await redisClient.createRoom(roomId, ttl, meta);
    console.log(`✅ Room created: ${roomId}`);
    res.status(201).json({
      success: true, roomId, ttl,
      message: 'Room created successfully',
      maxMembers: meta.maxMembers || null,
      roomTtlMs: meta.roomTtlMs || null,
      hasPin: Boolean(meta.pinHash)
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ success: false, error: 'Failed to create room' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    res.json({
      success: true,
      room: { id: room.id, createdAt: room.createdAt, expiresAt: room.expiresAt, hasPin: Boolean(room.pinHash), maxMembers: room.maxMembers || null }
    });
  } catch (error) {
    console.error('Error checking room:', error);
    res.status(500).json({ success: false, error: 'Failed to check room' });
  }
});

router.post('/:id/join', validateJoinRoom, async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { pin, clientId, invite } = req.body || {};
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    if (room.pinHash) {
      const pinValid = bcrypt.compareSync(String(pin || ''), room.pinHash);
      if (!pinValid) return res.status(403).json({ success: false, error: 'Invalid PIN' });
    }
    if (invite) {
      const verify = (tokenStr, secret) => {
        try {
          const [h, p, s] = tokenStr.split('.');
          const data = `${h}.${p}`;
          const expected = require('crypto').createHmac('sha256', secret).update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
          if (expected !== s) return null;
          const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
          if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
          return payload;
        } catch { return null; }
      };
      const payload = verify(String(invite), process.env.INVITE_SECRET || 'dev-invite');
      if (!payload || payload.roomId !== roomId || payload.scope !== 'join') {
        return res.status(403).json({ success: false, error: 'Invalid invite' });
      }
    }
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

// POST /api/rooms/:id/leave — remove member and burn room if last one out
router.post('/:id/leave', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { clientId } = req.body || {};
    if (!clientId) return res.status(400).json({ success: false, error: 'clientId required' });

    const remaining = await redisClient.removeMember(roomId, clientId);
    let burned = false;

    if (remaining === 0) {
      // Last member left — burn the room
      const client = redisClient.getClient();
      await client.del(`room:${roomId}`);
      await client.del(`room:${roomId}:messages`);
      await client.del(`room:${roomId}:members`);
      console.log(`🔥 Room burned (all members left): ${roomId}`);
      burned = true;
    }

    return res.json({ success: true, burned, remaining });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ success: false, error: 'Failed to leave room' });
  }
});

router.post('/:id/invite', validateInvite, async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { ttlSeconds = 1800 } = req.body || {};
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payload = Buffer.from(JSON.stringify({ roomId, scope: 'join', iat: now, exp: now + Math.min(ttlSeconds, 24 * 3600) })).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${header}.${payload}`;
    const sig = require('crypto').createHmac('sha256', process.env.INVITE_SECRET || 'dev-invite').update(data).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return res.json({ success: true, token: `${data}.${sig}` });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ success: false, error: 'Failed to create invite' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const client = redisClient.getClient();
    await client.del(`room:${roomId}`);
    await client.del(`room:${roomId}:messages`);
    // eslint-disable-next-line no-console
    console.log(`🗑️ Room deleted: ${roomId}`);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error deleting room:', error);
    res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
});

// POST /api/rooms/:id/extend — add time to an existing room
router.post('/:id/extend', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { addSeconds = 1800 } = req.body || {};
    const room = await redisClient.getRoom(roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });

    const client = redisClient.getClient();
    const currentTtl = await client.ttl(`room:${roomId}`);
    const newTtl = Math.min(currentTtl + addSeconds, 86400); // cap at 24h

    // Update Redis TTL
    await client.expire(`room:${roomId}`, newTtl);
    await client.expire(`room:${roomId}:members`, newTtl);
    await client.expire(`room:${roomId}:messages`, newTtl);

    // Update stored expiresAt
    room.expiresAt = new Date(Date.now() + newTtl * 1000).toISOString();
    await client.set(`room:${roomId}`, JSON.stringify(room));
    await client.expire(`room:${roomId}`, newTtl);

    // eslint-disable-next-line no-console
    console.log(`⏰ Room extended: ${roomId} → +${addSeconds}s (new TTL: ${newTtl}s)`);
    return res.json({ success: true, newExpiresAt: room.expiresAt, newTtl });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error extending room:', error);
    res.status(500).json({ success: false, error: 'Failed to extend room' });
  }
});

module.exports = router;
