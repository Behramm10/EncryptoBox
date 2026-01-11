import React, { useState, useEffect } from 'react';

import AttachmentViewer from './AttachmentViewer';

const MessageList = ({ messages, onDecryptMessage, isLoading, password, roomId, onAttachmentViewed }) => {
  const [decryptedMessages, setDecryptedMessages] = useState({});
  const [decryptingMessages, setDecryptingMessages] = useState(new Set());
  const [clientId, setClientId] = useState('');

  // Decrypt messages when they change
  useEffect(() => {
    const decryptMessages = async () => {
      for (const message of messages) {
        if (!decryptedMessages[message.id] && !decryptingMessages.has(message.id)) {
          setDecryptingMessages(prev => new Set(prev).add(message.id));
          
          try {
            const decryptedText = await onDecryptMessage(message);
            // Try to parse as JSON (attachment metadata)
            let value = decryptedText;
            try {
              const parsed = JSON.parse(decryptedText);
              if (parsed && parsed.__attachment) {
                value = parsed;
              }
            } catch (error) {
              // Not JSON, use as plain text
              // eslint-disable-next-line no-unused-vars
              const _ = error;
            }

            setDecryptedMessages(prev => ({
              ...prev,
              [message.id]: value
            }));
          } catch (error) {
            console.error('Failed to decrypt message:', error);
            setDecryptedMessages(prev => ({
              ...prev,
              [message.id]: '❌ Failed to decrypt message'
            }));
          } finally {
            setDecryptingMessages(prev => {
              const newSet = new Set(prev);
              newSet.delete(message.id);
              return newSet;
            });
          }
        }
      }
    };

    decryptMessages();
  }, [messages, onDecryptMessage, decryptedMessages, decryptingMessages]);

  // Load clientId for differentiating sender/receiver styling
  useEffect(() => {
    const existing = window.localStorage.getItem('encryptobox_client_id');
    if (existing) setClientId(existing);
  }, []);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeUntilExpiry = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry - now;
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const isExpired = (expiresAt) => {
    return new Date(expiresAt) <= new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="relative">
            <svg className="animate-spin h-10 w-10 text-primary-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="absolute inset-0 bg-primary-400/10 blur-xl rounded-full"></div>
          </div>
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-accent-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md border border-white/10">
          <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-200 mb-2">No messages yet</h3>
        <p className="text-gray-400">Start the conversation by sending your first encrypted message!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
      {messages.map((message) => {
        const decryptedValue = decryptedMessages[message.id];
        const isAttachment = !!(decryptedValue && typeof decryptedValue === 'object' && decryptedValue.__attachment);
        const isDecrypting = !isAttachment && decryptingMessages.has(message.id);
        const decryptedText = !isAttachment ? decryptedValue : null;
        const expired = isExpired(message.expiresAt);
        
        const isMine = message.senderId && clientId && message.senderId === clientId;
        return (
          <div
            key={message.id}
            className={`message-bubble ${
              expired 
                ? 'bg-white/5 text-gray-500 opacity-50 border border-white/5' 
                : isMine 
                  ? 'message-sent ml-auto' 
                  : 'message-received mr-auto'
            } animate-slide-up transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {isAttachment ? (
                  <AttachmentViewer roomId={roomId} message={decryptedValue} password={password} onViewedOnce={onAttachmentViewed} />
                ) : isDecrypting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin h-4 w-4 text-primary-300 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-300">Decrypting...</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary-300">🔒</span>
                    <p className="text-sm leading-relaxed">{decryptedText || 'Loading...'}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs opacity-60 mt-2 pt-2 border-t border-white/10">
              <span className="text-gray-400">{formatTime(message.timestamp)}</span>
              <div className="flex items-center space-x-2">
                {expired ? (
                  <span className="text-red-400 animate-pulse flex items-center gap-1">
                    <span>🔥</span>
                    <span>Expired</span>
                  </span>
                ) : (
                  <>
                    <span className="text-gray-400">⏰ {getTimeUntilExpiry(message.expiresAt)}</span>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse shadow-lg shadow-primary-400/50"></div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
