import React, { useRef, useState, useEffect } from 'react';
import { encryptBytes, decryptBytes } from '../utils/crypto';

const VaultPanel = ({ roomId, password }) => {
  const fileRef = useRef(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const addItem = async (file) => {
    setError(null);
    setLoading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const { ciphertextBytes, iv, salt } = await encryptBytes(buf, password);
      // Use vault endpoints via fetch to avoid expanding api.js more
      const initRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/rooms/${roomId}/vault/init`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type || 'application/octet-stream', ttlMs: 24*3600*1000 })
      });
      const init = await initRes.json();
      if (!init.success) throw new Error(init.error || 'Failed to init');
      const upRes = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/rooms/${roomId}/vault/${init.id}`, {
        method: 'PUT', headers: {}, body: ciphertextBytes
      });
      const up = await upRes.json();
      if (!up.success) throw new Error(up.error || 'Failed to upload');
      setItems(prev => [{ id: init.id, name: file.name, mimeType: file.type, iv: btoa(String.fromCharCode(...iv)), salt: btoa(String.fromCharCode(...salt)) }, ...prev]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadItem = async (item) => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/rooms/${roomId}/vault/${item.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const cipher = new Uint8Array(await res.arrayBuffer());
      const iv = Uint8Array.from(atob(item.iv), c => c.charCodeAt(0));
      const salt = Uint8Array.from(atob(item.salt), c => c.charCodeAt(0));
      const plain = await decryptBytes(cipher, iv, salt, password);
      const blob = new Blob([plain], { type: item.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = item.name || 'file'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Zero-Knowledge Vault</h4>
        <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={loading}>{loading ? 'Uploading…' : 'Add File'}</button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && addItem(e.target.files[0])} />
      </div>
      {error && <div className="text-xs text-red-600 mb-2">{error}</div>}
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
            <div className="truncate text-sm">{it.name}</div>
            <button className="btn-secondary !py-1 !px-2" onClick={() => downloadItem(it)}>Download</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-gray-500">No files yet.</li>}
      </ul>
    </div>
  );
};

export default VaultPanel;


