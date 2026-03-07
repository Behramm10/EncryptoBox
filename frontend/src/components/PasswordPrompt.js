import React, { useState } from 'react';
import { validatePassword } from '../utils/crypto';

const PasswordPrompt = ({ onPasswordSet, roomId: _roomId, isNewRoom }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({ isValid: false, errors: [] });
  const [isSetting, setIsSetting] = useState(false);
  const [error, setError] = useState(null);

  const normalizeSecret = (s) => (s || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (newPassword) {
      setValidation(validatePassword(newPassword));
    } else {
      setValidation({ isValid: false, errors: [] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validation.isValid) { setError('Please fix password validation errors'); return; }
    if (isNewRoom && normalizeSecret(password) !== normalizeSecret(confirmPassword)) {
      setError('Passwords do not match'); return;
    }
    setIsSetting(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      onPasswordSet(password);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSetting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-400/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/20">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-2xl font-bold neon-text mb-2">
            {isNewRoom ? 'Set Room Password' : 'Enter Room Password'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isNewRoom
              ? 'Create a strong password to encrypt your messages. This password will be used to encrypt and decrypt all messages in this room.'
              : 'Enter the room password to decrypt and read messages. This password is never sent to our servers.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              {isNewRoom ? 'Create Password' : 'Room Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                className={`input-field pr-10 ${!validation.isValid && password ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                placeholder="Enter a strong password..."
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300">
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {password && (
              <div className="mt-3 glass rounded-xl p-3 border border-white/10">
                <div className="text-xs text-gray-400 mb-2">Password requirements:</div>
                <ul className="space-y-1">
                  {[
                    { text: 'At least 8 characters', valid: password.length >= 8 },
                    { text: 'One uppercase letter', valid: /[A-Z]/.test(password) },
                    { text: 'One lowercase letter', valid: /[a-z]/.test(password) },
                    { text: 'One number', valid: /\d/.test(password) },
                    { text: 'One special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
                  ].map((req, index) => (
                    <li key={index} className={`flex items-center text-xs ${req.valid ? 'text-green-400' : 'text-red-400'}`}>
                      <svg className={`w-3 h-3 mr-2 flex-shrink-0 ${req.valid ? 'text-green-400' : 'text-red-400'}`} fill="currentColor" viewBox="0 0 20 20">
                        {req.valid ? (
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        )}
                      </svg>
                      {req.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {isNewRoom && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input-field ${isNewRoom && confirmPassword && normalizeSecret(password) !== normalizeSecret(confirmPassword) ? 'border-red-500/50 focus:ring-red-500' : ''}`}
                placeholder="Confirm your password..."
                required
              />
              {isNewRoom && confirmPassword && normalizeSecret(password) !== normalizeSecret(confirmPassword) && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
            </div>
          )}

          {error && (
            <div className="glass border border-red-500/30 bg-red-500/10 rounded-xl p-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-300">{error}</span>
              </div>
            </div>
          )}

          <button type="submit" disabled={!validation.isValid || (isNewRoom && normalizeSecret(password) !== normalizeSecret(confirmPassword)) || isSetting} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {isSetting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Setting up encryption...
              </span>
            ) : (
              isNewRoom ? 'Create Secure Room' : 'Enter Room'
            )}
          </button>
        </form>

        <div className="mt-6 glass border border-primary-500/20 bg-primary-500/5 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-primary-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-primary-300 mb-1">Security Notice</h3>
              <p className="text-xs text-gray-400">
                Your password is never sent to our servers. It&apos;s used locally to encrypt/decrypt messages.
                {isNewRoom && ' Share this password securely with others who should access this room.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordPrompt;
