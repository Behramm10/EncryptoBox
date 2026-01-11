import React from 'react';

const PasswordTipModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">📞</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Share password via a different channel</h3>
            <p className="text-sm text-gray-700">
              For maximum security, share the room password over a separate channel (call/SMS) and not in this chat.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-primary">Got it</button>
        </div>
      </div>
    </div>
  );
};

export default PasswordTipModal;


