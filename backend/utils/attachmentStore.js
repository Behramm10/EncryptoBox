const crypto = require('crypto');

/**
 * Ephemeral in-memory attachment store with TTL and optional view-once semantics.
 * This process memory store is swept periodically; data is lost on restart.
 */
class AttachmentStore {
  constructor() {
    this.store = new Map(); // id -> { id, roomId, mimeType, size, ttlMs, expiresAt, viewOnce, category, ciphertext }
    this.sweepIntervalMs = 30_000;
    this.maxSizeBytes = parseInt(process.env.ATTACHMENT_MAX_BYTES || `${10 * 1024 * 1024}`, 10); // default 10MB
    this._startSweeper();
  }

  _startSweeper() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.store.entries()) {
        if (entry.expiresAt <= now) {
          this.store.delete(id);
        }
      }
    }, this.sweepIntervalMs).unref?.();
  }

  _nowPlus(ttlMs) {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 5 * 60 * 1000; // default 5m
    return Date.now() + ttl;
  }

  _generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  initAttachment({ roomId, mimeType, ttlMs, viewOnce = false, category = 'chat' }) {
    const id = this._generateId();
    const entry = {
      id,
      roomId,
      mimeType,
      size: 0,
      ttlMs: Number.isFinite(ttlMs) ? ttlMs : 5 * 60 * 1000,
      expiresAt: this._nowPlus(ttlMs),
      viewOnce: Boolean(viewOnce),
      category,
      ciphertext: null
    };
    this.store.set(id, entry);
    return entry;
  }

  putCiphertext(id, ciphertextBuffer) {
    const entry = this.store.get(id);
    if (!entry) return null;
    if (!Buffer.isBuffer(ciphertextBuffer)) return null;
    if (ciphertextBuffer.length > this.maxSizeBytes) {
      throw new Error('Attachment too large');
    }
    entry.size = ciphertextBuffer.length;
    entry.ciphertext = ciphertextBuffer;
    // refresh expiry relative to original ttl window
    entry.expiresAt = this._nowPlus(entry.ttlMs);
    this.store.set(id, entry);
    return entry;
  }

  get(id) {
    const entry = this.store.get(id);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(id);
      return null;
    }
    return entry;
  }

  delete(id) {
    return this.store.delete(id);
  }
}

const attachmentStore = new AttachmentStore();
module.exports = attachmentStore;


