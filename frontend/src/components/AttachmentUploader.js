import React, { useRef, useState } from 'react';
import { attachmentsAPI } from '../utils/api';
import { encryptBytes } from '../utils/crypto';

const AttachmentUploader = ({ roomId, password, onAttachmentSent }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [ttlMs, setTtlMs] = useState(5 * 60 * 1000);

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { ciphertextBytes, iv, salt } = await encryptBytes(new Uint8Array(arrayBuffer), password);

      const init = await attachmentsAPI.init(roomId, { mimeType: file.type || 'application/octet-stream', ttlMs });
      const { id, uploadToken } = init;
      await attachmentsAPI.upload(roomId, id, uploadToken, ciphertextBytes);

      onAttachmentSent?.({
        type: 'attachment',
        id,
        name: file.name,
        mimeType: file.type,
        size: ciphertextBytes.length,
        ttlMs,
        // include iv/salt for decryption metadata in chat message
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt))
      });
    } catch (err) {
      setError(err.message || 'Failed to upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" className="btn-secondary" onClick={handleChooseFile} disabled={isUploading}>
          {isUploading ? 'Uploading…' : 'Attach File'}
        </button>
        <select className="input-field !h-9 !py-1 !px-2 w-36" value={ttlMs} onChange={(e) => setTtlMs(parseInt(e.target.value, 10))}>
          <option value={30_000}>30s</option>
          <option value={5 * 60 * 1000}>5m</option>
          <option value={60 * 60 * 1000}>1h</option>
          <option value={24 * 60 * 60 * 1000}>24h</option>
        </select>
      </div>
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
};

export default AttachmentUploader;


