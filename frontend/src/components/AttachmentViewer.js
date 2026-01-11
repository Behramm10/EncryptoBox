import React, { useEffect, useState } from 'react';
import { attachmentsAPI } from '../utils/api';
import { decryptBytes } from '../utils/crypto';

const AttachmentViewer = ({ roomId, message, password, onViewedOnce }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let revoked = false;
    const load = async () => {
      try {
        setLoading(true);
        const { downloadToken } = await attachmentsAPI.mintDownloadToken(roomId, message.id, 300);
        const url = attachmentsAPI.buildDownloadUrl(process.env.REACT_APP_API_URL, roomId, message.id, downloadToken);
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch attachment');
        const buf = new Uint8Array(await res.arrayBuffer());
        const iv = Uint8Array.from(atob(message.iv), c => c.charCodeAt(0));
        const salt = Uint8Array.from(atob(message.salt), c => c.charCodeAt(0));
        const plain = await decryptBytes(buf, iv, salt, password);
        const blob = new Blob([plain], { type: message.mimeType || 'application/octet-stream' });
        const obj = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(obj);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [roomId, message, password]);

  const afterView = async () => {
    if (message.viewOnce) {
      try {
        await attachmentsAPI.delete(roomId, message.id);
      } catch (error) {
        // Silently fail if deletion fails (attachment may already be deleted)
        console.warn('Failed to delete attachment:', error);
      }
      onViewedOnce?.(message.id);
    }
  };

  if (loading) return <div className="text-sm text-gray-500">Loading attachment…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!objectUrl) return null;

  if ((message.mimeType || '').startsWith('image/')) {
    return <img src={objectUrl} alt={message.name || 'attachment'} className="max-h-64 rounded" onLoad={afterView} />;
  }
  if ((message.mimeType || '') === 'application/pdf') {
    return (
      <iframe title={message.name || 'attachment'} src={objectUrl} className="w-full h-64 rounded border" onLoad={afterView} />
    );
  }
  return (
    <a href={objectUrl} download={message.name || 'file'} className="text-primary-600 underline" onClick={afterView}>
      Download {message.name || 'file'}
    </a>
  );
};

export default AttachmentViewer;


