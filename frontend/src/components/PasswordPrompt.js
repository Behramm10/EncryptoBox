import React, { useState } from 'react';
import { validatePassword } from '../utils/crypto';

const PasswordPrompt = ({ onPasswordSet, roomId: _roomId, isNewRoom }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({ isValid: false, errors: [] });
  const [isSetting, setIsSetting] = useState(false);
  const [error, setError] = useState(null);

  // Normalize secrets to avoid hidden unicode or zero-width characters causing false mismatches
  const normalizeSecret = (s) => (s || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    if (newPassword) {
      const validationResult = validatePassword(newPassword);
      setValidation(validationResult);
    } else {
      setValidation({ isValid: false, errors: [] });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validation.isValid) {
      setError('Please fix password validation errors');
      return;
    }

    if (isNewRoom && normalizeSecret(password) !== normalizeSecret(confirmPassword)) {
      setError('Passwords do not match');
      return;
    }

    setIsSetting(true);
    setError(null);

    try {
      // Simulate a small delay for UX
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
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Set Room Password
          </h2>
          <p className="text-gray-600">
            {isNewRoom 
              ? 'Create a strong password to encrypt your messages. This password will be used to encrypt and decrypt all messages in this room.'
              : 'Enter the room password to decrypt and read messages. This password is never sent to our servers.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              {isNewRoom ? 'Create Password' : 'Room Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                className={`input-field pr-10 ${!validation.isValid && password ? 'border-red-300 focus:ring-red-500' : ''}`}
                placeholder="Enter a strong password..."
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Password Validation */}
            {password && (
              <div className="mt-2">
                <div className="text-xs text-gray-600 mb-2">Password requirements:</div>
                <ul className="space-y-1">
                  {[
                    { text: 'At least 8 characters', valid: password.length >= 8 },
                    { text: 'One uppercase letter', valid: /[A-Z]/.test(password) },
                    { text: 'One lowercase letter', valid: /[a-z]/.test(password) },
                    { text: 'One number', valid: /\d/.test(password) },
                    { text: 'One special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
                  ].map((req, index) => (
                    <li key={index} className={`flex items-center text-xs ${req.valid ? 'text-green-600' : 'text-red-600'}`}>
                      <svg className={`w-3 h-3 mr-2 ${req.valid ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 20 20">
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

          {/* Confirm Password (only for new rooms) */}
          {isNewRoom && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`input-field ${
                  isNewRoom && confirmPassword && normalizeSecret(password) !== normalizeSecret(confirmPassword)
                    ? 'border-red-300 focus:ring-red-500'
                    : ''
                }`}
                placeholder="Confirm your password..."
                required
              />
              {isNewRoom && confirmPassword && normalizeSecret(password) !== normalizeSecret(confirmPassword) && (
                <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!validation.isValid || (isNewRoom && normalizeSecret(password) !== normalizeSecret(confirmPassword)) || isSetting}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
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

        {/* Security Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Security Notice
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Your password is never sent to our servers. It&apos;s used locally to encrypt/decrypt messages.
                  {isNewRoom && ' Share this password securely with others who should access this room.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordPrompt;
