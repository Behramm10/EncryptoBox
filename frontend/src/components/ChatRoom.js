import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import AttachmentUploader from './AttachmentUploader';
import MessageInput from './MessageInput';
import PasswordPrompt from './PasswordPrompt';
import PasswordTipModal from './PasswordTipModal';
import { messageAPI, roomAPI } from '../utils/api';
import { generateRoomId } from '../utils/crypto';

const ChatRoom = ({ roomData, onLeaveRoom }) => {
  const [messages, setMessages] = useState([]);
  const [isLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState(null);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [clientId, setClientId] = useState('');
  const pollIntervalRef = useRef(null);
  const [showPasswordTip, setShowPasswordTip] = useState(false);

  // Removed auto-scroll to prevent the page jumping to the bottom on new messages

  // Ensure we have a stable clientId for sender/receiver styling
  useEffect(() => {
    const existing = window.localStorage.getItem('encryptobox_client_id');
    if (existing) {
      setClientId(existing);
    } else {
      const id = generateRoomId();
      window.localStorage.setItem('encryptobox_client_id', id);
      setClientId(id);
    }
  }, []);

  // Set up message polling
  useEffect(() => {
    if (isPasswordSet && roomData.roomId) {
      // Try joining room (handles PINless and invite)
      const inviteFromUrl = new URLSearchParams(window.location.search).get('invite');
      const inviteToken = inviteFromUrl || roomData.inviteToken || undefined;
      roomAPI.joinRoom(roomData.roomId, { clientId, invite: inviteToken }).catch(() => {});
      // Initial message load
      loadMessages();
      
      // Set up polling for new messages
      pollIntervalRef.current = setInterval(loadMessages, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isPasswordSet, roomData.roomId, roomData.inviteToken, clientId]);

  const loadMessages = async () => {
    try {
      const response = await messageAPI.getMessages(roomData.roomId);
      setMessages(response.messages || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePasswordSet = (passwordValue) => {
    setPassword(passwordValue);
    setIsPasswordSet(true);
    const dismissed = sessionStorage.getItem('password_tip_dismissed');
    if (!dismissed) setShowPasswordTip(true);
  };

  const handleSendMessage = async (messageText, ttlSeconds = 300) => {
    if (!password) {
      setError('Password not set');
      return;
    }

    try {
      // Import encryption function dynamically to avoid issues
      const { encryptMessage } = await import('../utils/crypto');
      
      // Encrypt the message
      const encryptedData = await encryptMessage(messageText, password);
      
      // Send to server
      await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, ttlSeconds);
      
      // Reload messages to show the new one (no auto-scroll)
      await loadMessages();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendAttachmentMeta = async (meta) => {
    // Send an attachment metadata message as plaintext JSON encrypted like normal messages
    const { encryptMessage } = await import('../utils/crypto');
    const payload = JSON.stringify({ __attachment: true, ...meta });
    const encryptedData = await encryptMessage(payload, password);
    await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, Math.floor((meta.ttlMs || 300000) / 1000));
    await loadMessages();
  };

  const handleDecryptMessage = async (encryptedMessage) => {
    if (!password) return null;

    try {
      const { decryptMessage } = await import('../utils/crypto');
      return await decryptMessage(encryptedMessage, password);
    } catch (err) {
      console.error('Decryption error:', err);
      return '❌ Failed to decrypt message';
    }
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
      {/* Room Header */}
      <div className="card p-6 mb-6 glow-effect">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold neon-text mb-1">
                Secure Chat Room
              </h2>
              <div className="flex items-center space-x-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                  <span className="font-mono text-primary-300">{roomData.roomId.slice(0, 8)}...</span>
                </span>
                <span className="text-gray-600">•</span>
                <span>{messages.length} messages</span>
                <span className="text-gray-600">•</span>
                <span className="text-red-400">⏱️ 5m TTL</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={async () => {
                try {
                  const { token } = await roomAPI.createInvite(roomData.roomId, 1800);
                  const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomData.roomId)}&invite=${encodeURIComponent(token)}`;
                  await navigator.clipboard.writeText(url);
                  alert('Invite link copied to clipboard');
                } catch (e) {
                  alert('Failed to create invite');
                }
              }}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Invite
              </span>
            </button>
            <button
              onClick={onLeaveRoom}
              className="btn-secondary text-sm"
            >
              Leave
            </button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 glass border border-red-500/30 bg-red-500/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-300">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-400">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Messages - widened area */}
        <div className="lg:col-span-8">
          <div className="card p-6 min-h-[65vh] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
                Messages
              </h3>
              <span className="text-xs text-gray-500">{messages.length} total</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <MessageList 
                messages={messages}
                onDecryptMessage={handleDecryptMessage}
                isLoading={isLoading}
                password={password}
                roomId={roomData.roomId}
                onAttachmentViewed={(_id) => {
                  // best-effort; messages auto-expire
                }}
              />
            </div>
          </div>
        </div>

        {/* Message Input + Room Info Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
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

          {/* Room Info */}
          <div className="card p-6 sticky top-[280px]">
            <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Room Info
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Room ID</span>
                <span className="font-mono text-primary-300 text-xs">
                  {roomData.roomId.slice(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">TTL</span>
                <span className="text-red-400 font-semibold">5 minutes</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-gray-400">Encryption</span>
                <span className="text-primary-300 font-semibold">AES-256</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Status</span>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
                  <span className="text-primary-300 font-semibold">Secure</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatRoom;
