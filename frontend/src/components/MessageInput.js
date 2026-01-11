import React, { useEffect, useRef, useState } from 'react';

const MessageInput = ({ onSendMessage, disabled, onSendAttachment }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);
  const textareaRef = useRef(null);
  const [ttlSeconds, setTtlSeconds] = useState(300);

  // Auto-focus when component mounts
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || isSending || disabled) return;

    setIsSending(true);
    setError(null);

    try {
      await onSendMessage(message.trim(), ttlSeconds);
      setMessage(''); // Clear input on success
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            ref={textareaRef}
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your encrypted message... (Enter to send)"
            className="input-field resize-none h-28"
            disabled={isSending || disabled}
            maxLength={1000}
            required
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {message.length}/1000
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">TTL:</span>
              <select
                className="input-field !h-8 !py-1 !px-3 text-xs w-24 bg-white/5 border-white/10 text-gray-300"
                value={ttlSeconds}
                onChange={(e) => setTtlSeconds(parseInt(e.target.value, 10))}
              >
                <option value={30} className="bg-gray-900">30s</option>
                <option value={300} className="bg-gray-900">5m</option>
                <option value={3600} className="bg-gray-900">1h</option>
                <option value={86400} className="bg-gray-900">24h</option>
              </select>
            </div>
          </div>
        </div>

        {/* Attachment controls injected by parent */}
        {onSendAttachment}

        {/* Error Display */}
        {error && (
          <div className="glass border border-red-500/30 bg-red-500/10 rounded-xl p-3 backdrop-blur-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Send Button */}
        <button
          type="submit"
          disabled={!message.trim() || isSending || disabled}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Encrypting & Sending...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send Encrypted Message
            </span>
          )}
        </button>
      </form>

      {/* Security Notice */}
      <div className="mt-4 glass border border-primary-500/30 bg-primary-500/10 rounded-xl p-3 backdrop-blur-md">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-4 w-4 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-xs text-primary-300 leading-relaxed">
            <span className="font-semibold">Encrypted:</span> Your message is encrypted with AES-256-GCM before sending.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MessageInput;
