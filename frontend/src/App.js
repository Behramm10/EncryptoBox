import React, { useState, useEffect } from 'react';
import ChatRoom from './components/ChatRoom';
import RoomCreator from './components/RoomCreator';
import { healthAPI, roomAPI } from './utils/api';
import { useTheme } from './contexts/ThemeContext';

function App() {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [isLoadingInvite, setIsLoadingInvite] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Check API health on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthAPI.checkHealth();
        setIsConnected(true);
        setConnectionError(null);
      } catch (error) {
        setIsConnected(false);
        setConnectionError(error.message);
      }
    };

    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check for invite link in URL and auto-join room
  useEffect(() => {
    const handleInviteLink = async () => {
      if (!isConnected) return; // Wait for connection
      if (currentRoom) return; // Already in a room
      
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get('room');
      const inviteToken = urlParams.get('invite');
      
      // If both room and invite are present, automatically join
      if (roomId && inviteToken) {
        setIsLoadingInvite(true);
        try {
          const response = await roomAPI.getRoom(roomId);
          setCurrentRoom({
            roomId: response.room.id,
            ttl: response.room.ttl,
            isNewRoom: false,
            inviteToken: inviteToken // Store invite token for later use
          });
          // Clean up URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error('Failed to join room via invite:', error);
          // If room doesn't exist or error, just show the room creator
        } finally {
          setIsLoadingInvite(false);
        }
      }
    };

    handleInviteLink();
  }, [isConnected, currentRoom]);

  const handleRoomCreated = (roomData) => {
    setCurrentRoom(roomData);
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500/20 border-t-primary-400 mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full bg-primary-400/10 blur-xl animate-pulse"></div>
          </div>
          <h2 className="text-2xl font-bold neon-text mb-3">
            Connecting...
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            {connectionError || 'Establishing secure connection to server'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while processing invite link
  if (isLoadingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-500/20 border-t-primary-400 mx-auto mb-6"></div>
            <div className="absolute inset-0 rounded-full bg-primary-400/10 blur-xl animate-pulse"></div>
          </div>
          <h2 className="text-2xl font-bold neon-text mb-3">
            Joining Room...
          </h2>
          <p className="text-gray-400">
            Opening secure room via invite link
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950' : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'}`}>
      {/* Header */}
      <header className="glass border-b border-white/10 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <span className="text-xl">🔐</span>
                </div>
                <h1 className="text-2xl font-bold neon-text">
                  EncryptoBox
                </h1>
              </div>
              <div className="hidden sm:block">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 border border-primary-400/30 text-primary-300">
                  <span className="w-2 h-2 bg-primary-400 rounded-full mr-2 animate-pulse"></span>
                  Secure
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {currentRoom && (
                <>
                  <div className="hidden md:block px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-xs text-gray-400">Room</span>
                    <span className="block font-mono text-sm text-primary-300 mt-1">{currentRoom.roomId.slice(0, 8)}...</span>
                  </div>
                  <button
                    onClick={handleLeaveRoom}
                    className="btn-secondary text-sm"
                  >
                    Leave
                  </button>
                </>
              )}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl glass hover:bg-white/10 transition-all duration-300 hover:scale-110"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentRoom ? (
          <ChatRoom 
            roomData={currentRoom} 
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <RoomCreator onRoomCreated={handleRoomCreated} />
        )}
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">
              🔒 All encryption happens on your device. Messages self-destruct automatically.
            </p>
            <p className="text-xs text-gray-500">
              Built with React, Node.js, and Redis. No plaintext is ever stored on our servers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
