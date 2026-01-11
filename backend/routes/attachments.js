const express = require('express');
// HMAC-based compact JWT-like tokens implemented with crypto below
const attachmentStore = require('../utils/attachmentStore');

const router = express.Router();

function getSecret(type) {
  if (type === 'upload') return process.env.ATTACHMENT_UPLOAD_SECRET || (process.env.ATTACHMENT_SECRET || 'dev-upload-secret');
  if (type === 'download') return process.env.ATTACHMENT_DOWNLOAD_SECRET || (process.env.ATTACHMENT_SECRET || 'dev-download-secret');
  return process.env.ATTACHMENT_SECRET || 'dev-secret';
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signToken(payload, secret, ttlSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + (ttlSeconds || 300), ...payload };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(body));
  const data = `${headerB64}.${payloadB64}`;
  const sig = base64url(require('crypto').createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token, secret) {
  try {
    const [headerB64, payloadB64, sig] = token.split('.');
    if (!headerB64 || !payloadB64 || !sig) return null;
    const data = `${headerB64}.${payloadB64}`;
    const expected = base64url(require('crypto').createHmac('sha256', secret).update(data).digest());
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

// POST /api/rooms/:roomId/attachments/init
router.post('/:roomId/attachments/init', (req, res) => {
  try {
    const { roomId } = req.params;
    const { mimeType, ttlMs, viewOnce = false, category = 'chat' } = req.body || {};
    if (!mimeType) {
      return res.status(400).json({ success: false, error: 'mimeType required' });
    }
    const entry = attachmentStore.initAttachment({ roomId, mimeType, ttlMs, viewOnce, category });
    const uploadToken = signToken({ sub: entry.id, roomId, scope: 'upload' }, getSecret('upload'), 10 * 60);
    return res.status(201).json({ success: true, id: entry.id, uploadToken, expiresAt: entry.expiresAt });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to init attachment' });
  }
});

// PUT /api/rooms/:roomId/attachments/:id (raw body)
router.put('/:roomId/attachments/:id', express.raw({ type: '*/*', limit: process.env.ATTACHMENT_MAX_BYTES ? `${Math.ceil(parseInt(process.env.ATTACHMENT_MAX_BYTES, 10) / (1024*1024))}mb` : '12mb' }), (req, res) => {
  try {
    const { roomId, id } = req.params;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'Missing token' });
    const payload = verifyToken(token, getSecret('upload'));
    if (!payload || payload.sub !== id || payload.roomId !== roomId || payload.scope !== 'upload') {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }

    const buf = Buffer.from(req.body);
    const entry = attachmentStore.putCiphertext(id, buf);
    if (!entry) return res.status(404).json({ success: false, error: 'Attachment not found' });
    return res.json({ success: true, id, size: entry.size, expiresAt: entry.expiresAt });
  } catch (e) {
    if (e && /too large/i.test(String(e.message))) {
      return res.status(413).json({ success: false, error: 'Attachment too large' });
    }
    return res.status(500).json({ success: false, error: 'Failed to upload attachment' });
  }
});

// POST /api/rooms/:roomId/attachments/token -> mint short-lived download token
router.post('/:roomId/attachments/token', (req, res) => {
  try {
    const { roomId } = req.params;
    const { id, ttlSeconds = 300 } = req.body || {};
    if (!id) return res.status(400).json({ success: false, error: 'id required' });
    const entry = attachmentStore.get(id);
    if (!entry || entry.roomId !== roomId) return res.status(404).json({ success: false, error: 'Not found' });
    const downloadToken = signToken({ sub: id, roomId, scope: 'download' }, getSecret('download'), Math.min(ttlSeconds, 900));
    return res.json({ success: true, downloadToken });
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Failed to mint token' });
  }
});

// GET /api/rooms/:roomId/attachments/:id
router.get('/:roomId/attachments/:id', (req, res) => {
  try {
    const { roomId, id } = req.params;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
    if (!token) return res.status(401).json({ success: false, error: 'Missing token' });
    const payload = verifyToken(token, getSecret('download'));
    if (!payload || payload.sub !== id || payload.roomId !== roomId || payload.scope !== 'download') {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    const entry = attachmentStore.get(id);
    if (!entry) return res.status(404).json({ success: false, error: 'Not found' });
    if (!entry.ciphertext) return res.status(404).json({ success: false, error: 'Not uploaded' });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Attachment-Mime', entry.mimeType);
    res.setHeader('X-Attachment-Size', String(entry.size));
    res.status(200).end(entry.ciphertext);
    if (entry.viewOnce) {
      attachmentStore.delete(id);
    }
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Failed to download attachment' });
  }
});

// POST /api/rooms/:roomId/attachments/:id/delete
router.post('/:roomId/attachments/:id/delete', (req, res) => {
  const { roomId, id } = req.params;
  const entry = attachmentStore.get(id);
  if (!entry || entry.roomId !== roomId) return res.status(404).json({ success: false, error: 'Not found' });
  attachmentStore.delete(id);
  return res.json({ success: true });
});

module.exports = router;


