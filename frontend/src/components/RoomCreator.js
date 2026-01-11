import React, { useState } from 'react';
import { roomAPI } from '../utils/api';

const RoomCreator = ({ onRoomCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [maxMembers, setMaxMembers] = useState('');

  const handleCreateRoom = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await roomAPI.createRoom(3600);
      onRoomCreated({
        roomId: response.roomId,
        ttl: response.ttl,
        isNewRoom: true
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      const response = await roomAPI.getRoom(roomId.trim());
      onRoomCreated({
        roomId: response.room.id,
        ttl: response.room.ttl,
        isNewRoom: false
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-block mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mx-auto shadow-2xl shadow-primary-500/30 animate-float">
            <span className="text-4xl">🔐</span>
          </div>
        </div>
        <h2 className="text-4xl font-bold neon-text mb-4">
          Welcome to EncryptoBox
        </h2>
        <p className="text-lg text-gray-400 mb-2 max-w-2xl mx-auto">
          Create a secure, self-destructing chat room or join an existing one.
        </p>
        <p className="text-sm text-gray-500">
          All messages are encrypted on your device and automatically deleted after TTL expires.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Room */}
        <div className="card p-8 glow-effect hover:scale-[1.02] transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 backdrop-blur-md border border-primary-400/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🆕</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">
              Create New Room
            </h3>
            <p className="text-gray-400 text-sm">Start a new encrypted conversation that will expire in 1 hour.</p>
          </div>

          <div className="space-y-3 mb-6">
            <input 
              type="number" 
              min="2" 
              max="50" 
              value={maxMembers} 
              onChange={(e) => setMaxMembers(e.target.value)} 
              className="input-field" 
              placeholder="Optional: Max members" 
            />
          </div>

          <button onClick={handleCreateRoom} disabled={isCreating} className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            {isCreating ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Room...
              </span>
            ) : (
              'Create Secure Room'
            )}
          </button>
        </div>

        {/* Join Room */}
        <div className="card p-8 glow-effect hover:scale-[1.02] transition-all duration-300">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent-500/20 to-primary-500/20 backdrop-blur-md border border-accent-400/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔑</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-200 mb-2">
              Join Existing Room
            </h3>
            <p className="text-gray-400 text-sm">Enter a room ID to join an existing conversation.</p>
          </div>

          <form onSubmit={handleJoinRoom}>
            <div className="mb-6">
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID..."
                className="input-field"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isJoining || !roomId.trim()}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Joining Room...
                </span>
              ) : (
                'Join Room'
              )}
            </button>
          </form>
          
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-6 glass border border-red-500/30 bg-red-500/10 rounded-xl p-4 backdrop-blur-md">
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

      {/* Security Notice */}
      <div className="mt-10 glass border border-primary-500/30 bg-primary-500/10 rounded-2xl p-6 backdrop-blur-md">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-accent-500/20 border border-primary-400/30 flex items-center justify-center">
              <svg className="h-5 w-5 text-primary-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-primary-300 mb-3">
              Security Features
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-0.5">✓</span>
                <span>All messages encrypted with AES-256-GCM before leaving your device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-0.5">✓</span>
                <span>Messages automatically self-destruct after TTL expires</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-0.5">✓</span>
                <span>Room passwords never sent to servers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-400 mt-0.5">✓</span>
                <span>Zero-knowledge architecture - we cannot read your messages</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomCreator;
