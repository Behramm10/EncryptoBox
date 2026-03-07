const express = require('express');
const attachmentStore = require('../utils/attachmentStore');

const router = express.Router();

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getSecret() {
  return process.env.VAULT_SECRET || process.env.ATTACHMENT_SECRET || 'dev-vault-secret';
}

function signToken(payload, ttlSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + (ttlSeconds || 600), ...payload };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(body));
  const data = `${headerB64}.${payloadB64}`;
  const sig = base64url(require('crypto').createHmac('sha256', getSecret()).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [headerB64, payloadB64, sig] = token.split('.');
    if (!headerB64 || !payloadB64 || !sig) return null;
    const data = `${headerB64}.${payloadB64}`;
    const expected = base64url(require('crypto').createHmac('sha256', getSecret()).update(data).digest());
    if (expected !== sig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

router.post('/:roomId/vault/init', (req, res) => {
  try {
    const { roomId } = req.params;
    const { mimeType, ttlMs } = req.body || {};
    if (!mimeType) return res.status(400).json({ success: false, error: 'mimeType required' });
    const entry = attachmentStore.initAttachment({ roomId, mimeType, ttlMs, viewOnce: false, category: 'vault' });
    const uploadToken = signToken({ sub: entry.id, roomId, scope: 'vault-upload' }, 10 * 60);
    return res.status(201).json({ success: true, id: entry.id, uploadToken, expiresAt: entry.expiresAt });
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Failed to init vault item' });
  }
});

router.put('/:roomId/vault/:id', express.raw({ type: '*/*', limit: '12mb' }), (req, res) => {
  try {
    const { roomId, id } = req.params;
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, error: 'Missing token' });
    const payload = verifyToken(token);
    if (!payload || payload.sub !== id || payload.roomId !== roomId || payload.scope !== 'vault-upload') {
      return res.status(403).json({ success: false, error: 'Invalid token' });
    }
    const buf = Buffer.from(req.body);
    const entry = attachmentStore.putCiphertext(id, buf);
    if (!entry) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, size: entry.size, expiresAt: entry.expiresAt });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to upload' });
  }
});

router.get('/:roomId/vault/:id', (req, res) => {
  const { roomId, id } = req.params;
  const entry = attachmentStore.get(id);
  if (!entry || entry.roomId !== roomId || entry.category !== 'vault') return res.status(404).json({ success: false, error: 'Not found' });
  if (!entry.ciphertext) return res.status(404).json({ success: false, error: 'Not uploaded' });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Attachment-Mime', entry.mimeType);
  res.setHeader('X-Attachment-Size', String(entry.size));
  return res.status(200).end(entry.ciphertext);
});

router.post('/:roomId/vault/:id/delete', (req, res) => {
  const { roomId, id } = req.params;
  const entry = attachmentStore.get(id);
  if (!entry || entry.roomId !== roomId || entry.category !== 'vault') return res.status(404).json({ success: false, error: 'Not found' });
  attachmentStore.delete(id);
  return res.json({ success: true });
});

module.exports = router;
