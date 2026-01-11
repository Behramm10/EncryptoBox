const express = require('express');
const attachmentStore = require('../utils/attachmentStore');

const router = express.Router();

// Minimal vault: reuse attachment store with category 'vault'
router.post('/:roomId/vault/init', (req, res) => {
  try {
    const { roomId } = req.params;
    const { mimeType, ttlMs } = req.body || {};
    if (!mimeType) return res.status(400).json({ success: false, error: 'mimeType required' });
    const entry = attachmentStore.initAttachment({ roomId, mimeType, ttlMs, viewOnce: false, category: 'vault' });
    return res.status(201).json({ success: true, id: entry.id, expiresAt: entry.expiresAt });
  } catch (_) {
    return res.status(500).json({ success: false, error: 'Failed to init vault item' });
  }
});

router.put('/:roomId/vault/:id', express.raw({ type: '*/*', limit: '12mb' }), (req, res) => {
  try {
    const { id } = req.params;
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


