import React, { useState, useEffect, useRef, useCallback } from 'react';
import MessageList from './MessageList';
import AttachmentUploader from './AttachmentUploader';
import MessageInput from './MessageInput';
import PasswordPrompt from './PasswordPrompt';
import PasswordTipModal from './PasswordTipModal';
import QRModal from './QRModal';
import { messageAPI, roomAPI } from '../utils/api';
import { generateRoomId } from '../utils/crypto';
import { useToast } from '../contexts/ToastContext';

const ChatRoom = ({ roomData, onLeaveRoom }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState(null);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [clientId, setClientId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPasswordTip, setShowPasswordTip] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [roomExpiry, setRoomExpiry] = useState('');
  const pollIntervalRef = useRef(null);
  const expiryRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    const existing = window.localStorage.getItem('encryptobox_client_id');
    if (existing) {
      setClientId(existing);
    } else {
      const id = generateRoomId();
      window.localStorage.setItem('encryptobox_client_id', id);
      setClientId(id);
    }
    const name = window.localStorage.getItem('encryptobox_display_name') || '';
    setDisplayName(name);
  }, []);

  useEffect(() => {
    const updateExpiry = () => {
      if (!roomData.expiresAt) { setRoomExpiry('Unknown'); return; }
      const diff = new Date(roomData.expiresAt) - new Date();
      if (diff <= 0) { setRoomExpiry('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRoomExpiry(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    updateExpiry();
    expiryRef.current = setInterval(updateExpiry, 1000);
    return () => clearInterval(expiryRef.current);
  }, [roomData.expiresAt]);

  const loadMessages = useCallback(async () => {
    try {
      const response = await messageAPI.getMessages(roomData.roomId);
      setMessages(response.messages || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [roomData.roomId]);

  useEffect(() => {
    if (isPasswordSet && roomData.roomId) {
      const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
      const inviteToken = inviteFromUrl || roomData.inviteToken || undefined;
      roomAPI.joinRoom(roomData.roomId, { clientId, invite: inviteToken }).catch(() => { });
      loadMessages();
      pollIntervalRef.current = setInterval(loadMessages, 2000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isPasswordSet, roomData.roomId, roomData.inviteToken, clientId, loadMessages]);

  const handlePasswordSet = (passwordValue) => {
    setPassword(passwordValue);
    setIsPasswordSet(true);
    const dismissed = sessionStorage.getItem('password_tip_dismissed');
    if (!dismissed) setShowPasswordTip(true);
  };

  const handleDecryptMessage = useCallback(async (encryptedMessage) => {
    if (!password) return null;
    try {
      const { decryptMessage } = await import('../utils/crypto');
      return await decryptMessage(encryptedMessage, password);
    } catch (err) {
      console.error('Decryption error:', err);
      return '❌ Failed to decrypt message';
    }
  }, [password]);

  const handleSendMessage = async (messageText, ttlSeconds = 300) => {
    if (!password) { setError('Password not set'); return; }
    try {
      const { encryptMessage } = await import('../utils/crypto');
      const payload = displayName
        ? JSON.stringify({ t: messageText, n: displayName })
        : messageText;
      const encryptedData = await encryptMessage(payload, password);
      await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, ttlSeconds);
      await loadMessages();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendAttachmentMeta = async (meta) => {
    const { encryptMessage } = await import('../utils/crypto');
    const payload = JSON.stringify({ __attachment: true, ...meta });
    const encryptedData = await encryptMessage(payload, password);
    await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, Math.floor((meta.ttlMs || 300000) / 1000));
    await loadMessages();
  };

  const handleInvite = async () => {
    try {
      const { token } = await roomAPI.createInvite(roomData.roomId, 1800);
      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomData.roomId)}&invite=${encodeURIComponent(token)}`;
      setQrUrl(url);
    } catch (e) {
      toast('Failed to create invite link', 'error');
    }
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomData.roomId);
      toast('Room ID copied to clipboard!', 'success');
    } catch {
      toast('Could not copy Room ID', 'error');
    }
  };

  // Auto-burn: call leave API before navigating away
  const handleLeaveRoom = async () => {
    if (clientId) {
      await roomAPI.leaveRoom(roomData.roomId, clientId);
    }
    onLeaveRoom();
  };
  if (!isPasswordSet) {
    return (
      <PasswordPrompt
        onPasswordSet={handlePasswordSet}
        roomId={roomData.roomId}
        isNewRoom={roomData.isNewRoom}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PasswordTipModal isOpen={showPasswordTip} onClose={() => { setShowPasswordTip(false); sessionStorage.setItem('password_tip_dismissed', '1'); }} />
      {qrUrl && <QRModal url={qrUrl} onClose={() => setQrUrl(null)} />}

      {/* Room Header + Info Bar */}
      <div className="card p-6 mb-6 glow-effect">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold neon-text mb-1">Secure Chat Room</h2>
              <span className="text-xs text-gray-500">{messages.length} messages</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm" onClick={handleInvite}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Invite
              </span>
            </button>
            <button onClick={handleLeaveRoom} className="btn-secondary text-sm">Leave</button>
          </div>
        </div>

        {/* Room Info horizontal pill bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={handleCopyRoomId}
            title="Click to copy full Room ID"
            className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 hover:border-primary-500/40 transition-all group text-left"
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">Room ID</span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-indigo-600 dark:text-primary-300 truncate">
              {roomData.roomId.slice(0, 14)}…
              <svg className="w-3 h-3 flex-shrink-0 opacity-40 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
          </button>

          <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">Expires in</span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{roomExpiry}</span>
          </div>

          <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">Encryption</span>
            <span className="text-sm font-bold text-indigo-600 dark:text-primary-300">AES-256-GCM</span>
          </div>

          <div className="flex flex-col gap-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 dark:text-gray-400">Status</span>
            <span className="flex items-center gap-2 text-sm font-bold text-green-600 dark:text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Secure
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 glass border border-red-500/30 bg-red-500/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-400 mr-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-red-300">{error}</span>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Your display name:</span>
        <input
          type="text"
          value={displayName}
          onChange={e => {
            setDisplayName(e.target.value);
            window.localStorage.setItem('encryptobox_display_name', e.target.value);
          }}
          placeholder="Anonymous"
          maxLength={30}
          className="input-field text-xs py-1 px-3 w-40"
        />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="card p-6 min-h-[65vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
                Messages
              </h3>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-500">{messages.length} total</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <MessageList
                messages={messages}
                onDecryptMessage={handleDecryptMessage}
                isLoading={isLoading}
                password={password}
                roomId={roomData.roomId}
                onAttachmentViewed={(_id) => { }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send Message
            </h3>
            <MessageInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              onSendAttachment={
                password ? (
                  <AttachmentUploader roomId={roomData.roomId} password={password} onAttachmentSent={handleSendAttachmentMeta} />
                ) : null
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
