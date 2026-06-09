/* eslint-disable no-console */
import React, { useState, useEffect, useRef } from 'react';
import MessageList from './MessageList';
import AttachmentUploader from './AttachmentUploader';
import MessageInput from './MessageInput';
import PasswordPrompt from './PasswordPrompt';
import PasswordTipModal from './PasswordTipModal';
import { messageAPI, roomAPI } from '../utils/api';
import { generateRoomId, useDoubleRatchet } from '../utils/crypto';
import { io } from 'socket.io-client';

const ChatRoom = ({ roomData, onLeaveRoom }) => {
  const [messages, setMessages] = useState([]);
  const [p2pMessages, setP2pMessages] = useState([]);
  const [transportMode, setTransportMode] = useState('relay'); // 'p2p' or 'relay'
  const [isLoading] = useState(false);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState(null);
  const [isPasswordSet, setIsPasswordSet] = useState(false);
  const [clientId, setClientId] = useState('');
  const pollIntervalRef = useRef(null);
  const socketRef = useRef(null);
  const pcsRef = useRef({}); // maps socketId -> RTCPeerConnection
  const dcsRef = useRef({}); // maps socketId -> RTCDataChannel
  const [showPasswordTip, setShowPasswordTip] = useState(false);
  const [roomCountdown, setRoomCountdown] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isWindowFocused, setIsWindowFocused] = useState(true);



  // Room burn timer - auto-destroys page when room TTL expires
  useEffect(() => {
    if (!roomData.ttl) return;
    const burnAt = Date.now() + (roomData.ttl * 1000);

    const interval = setInterval(() => {
      const remaining = Math.max(0, burnAt - Date.now());
      setRoomCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        // Auto-burn: leave room when TTL expires
        onLeaveRoom();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomData.ttl]);

  const formatCountdown = (ms) => {
    if (ms === null) return '--:--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const saltBase64 = roomData.roomId ? btoa(roomData.roomId) : '';
  const {
    getInitialDHPublicKey,
    establishSession,
    encryptP2P,
    decryptP2P,
    shredSessions
  } = useDoubleRatchet(roomData.roomId, password, saltBase64, clientId);

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

  // Monitor tab/window focus and visibility for Anti-Forensics blurring
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    const handleVisibilityChange = () => {
      setIsWindowFocused(document.visibilityState === 'visible');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Bind global keyboard listeners to block DevTools and handle the panic kill hotkey (Ctrl + Q)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + Q: Panic Kill Switch
      if (e.ctrlKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        triggerPanicKill();
        return;
      }

      // Block F12
      if (e.keyCode === 123) {
        e.preventDefault();
        return;
      }

      // Block Ctrl + Shift + I (Inspect)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        return;
      }

      // Block Ctrl + Shift + J (Console)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        return;
      }

      // Block Ctrl + U (View Source)
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        return;
      }
    };

    // Block right-clicks to prevent "Inspect Element" context menu
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
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

  // Set up WebRTC Signaling and Peer Connections
  useEffect(() => {
    if (!isPasswordSet || !roomData.roomId || !clientId) return;

    const socketUrl = (process.env.REACT_APP_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');
    console.log('Connecting to signaling server:', socketUrl);
    
    const socket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Signaling connection established:', socket.id);
      socket.emit('join-room', { roomId: roomData.roomId, clientId });
    });

    // Handle existing peers
    socket.on('room-peers', (peers) => {
      peers.forEach((peer) => {
        // Compare client IDs: the one with smaller ID initiates
        if (clientId < peer.clientId) {
          initiateP2P(peer.socketId, peer.clientId);
        }
      });
    });

    // Handle new peer joining
    socket.on('peer-joined', ({ socketId, clientId: peerClientId }) => {
      console.log('Peer joined signaling:', peerClientId, socketId);
      if (clientId < peerClientId) {
        initiateP2P(socketId, peerClientId);
      }
    });

    // Handle incoming signals
    socket.on('signal', ({ senderSocketId, senderClientId, signalData }) => {
      handleSignaling(senderSocketId, senderClientId, signalData);
    });

    // Handle peer disconnecting
    socket.on('peer-left', ({ socketId, clientId: peerClientId }) => {
      console.log('Peer left signaling:', peerClientId, socketId);
      cleanupPeer(socketId);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      
      // Close all peer connections
      Object.keys(pcsRef.current).forEach((id) => {
        cleanupPeer(id);
      });
    };
  }, [isPasswordSet, roomData.roomId, clientId]);

  const initiateP2P = async (peerSocketId, peerClientId) => {
    console.log('Initiating P2P with:', peerClientId);
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19002' },
          { urls: 'stun:stun1.l.google.com:19002' },
          { urls: 'stun:stun2.l.google.com:19002' }
        ]
      });
      pcsRef.current[peerSocketId] = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('signal', {
            targetSocketId: peerSocketId,
            signalData: { type: 'candidate', candidate: event.candidate }
          });
        }
      };

      // Create data channel
      const dc = pc.createDataChannel('secure-chat-channel', { ordered: true });
      dcsRef.current[peerSocketId] = dc;
      setupDataChannel(dc, peerSocketId);

      // Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('signal', {
          targetSocketId: peerSocketId,
          signalData: { type: 'offer', sdp: offer.sdp }
        });
      }
    } catch (err) {
      console.error('Failed to initiate P2P:', err);
    }
  };

  const handleSignaling = async (senderSocketId, senderClientId, signalData) => {
    try {
      if (signalData.type === 'offer') {
        console.log('Received P2P offer from:', senderClientId);
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19002' },
            { urls: 'stun:stun1.l.google.com:19002' },
            { urls: 'stun:stun2.l.google.com:19002' }
          ]
        });
        pcsRef.current[senderSocketId] = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('signal', {
              targetSocketId: senderSocketId,
              signalData: { type: 'candidate', candidate: event.candidate }
            });
          }
        };

        // Listen for data channel
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          dcsRef.current[senderSocketId] = dc;
          setupDataChannel(dc, senderSocketId);
        };

        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signalData.sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (socketRef.current) {
          socketRef.current.emit('signal', {
            targetSocketId: senderSocketId,
            signalData: { type: 'answer', sdp: answer.sdp }
          });
        }
      } else if (signalData.type === 'answer') {
        console.log('Received P2P answer from:', senderClientId);
        const pc = pcsRef.current[senderSocketId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signalData.sdp }));
        }
      } else if (signalData.type === 'candidate') {
        const pc = pcsRef.current[senderSocketId];
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      }
    } catch (err) {
      console.error('Error handling signaling:', err);
    }
  };

  const setupDataChannel = (dc, peerSocketId) => {
    dc.onopen = async () => {
      console.log('RTCDataChannel opened with peer socket:', peerSocketId);
      
      // Share initial DH public key for Double Ratchet establishment
      try {
        const localDHPubKey = await getInitialDHPublicKey(peerSocketId);
        dc.send(JSON.stringify({
          type: 'dh-handshake',
          publicKey: localDHPubKey,
          senderClientId: clientId
        }));
      } catch (err) {
        console.error('Failed to send initial DH public key:', err);
      }
    };

    dc.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        if (payload.type === 'dh-handshake') {
          console.log('Received DH handshake from peer:', peerSocketId);
          await establishSession(peerSocketId, payload.publicKey, payload.senderClientId);
          setTransportMode('p2p');
          return;
        }

        console.log('Received message via P2P:', payload.id);
        
        // Decrypt using Double Ratchet
        const decryptedText = await decryptP2P(peerSocketId, payload);

        const decryptedMessage = {
          id: payload.id,
          roomId: payload.roomId,
          senderId: payload.senderId,
          timestamp: payload.timestamp,
          expiresAt: payload.expiresAt,
          decryptedText: decryptedText,
          ciphertext: payload.ciphertext,
          iv: payload.iv,
          dhPublicKey: payload.dhPublicKey,
          seq: payload.seq
        };

        setP2pMessages((prev) => {
          if (prev.some((msg) => msg.id === payload.id)) return prev;
          return [...prev, decryptedMessage];
        });
      } catch (err) {
        console.error('Failed to parse/decrypt P2P message payload:', err);
      }
    };

    dc.onclose = () => {
      console.log('RTCDataChannel closed with peer socket:', peerSocketId);
      cleanupPeer(peerSocketId);
    };

    dc.onerror = (err) => {
      console.error('RTCDataChannel error:', err);
      cleanupPeer(peerSocketId);
    };
  };

  const cleanupPeer = (socketId) => {
    const pc = pcsRef.current[socketId];
    if (pc) {
      pc.close();
      delete pcsRef.current[socketId];
    }
    const dc = dcsRef.current[socketId];
    if (dc) {
      dc.close();
      delete dcsRef.current[socketId];
    }
    // Update transport mode state
    if (Object.keys(dcsRef.current).length === 0) {
      setTransportMode('relay');
    }
  };

  const triggerPanicKill = () => {
    // 1. Wipe React component states
    setPassword(null);
    setIsPasswordSet(false);
    setMessages([]);
    setP2pMessages([]);

    // 2. Shred cryptographic sessions
    shredSessions();

    // 3. Clear browser storage layers
    window.sessionStorage.clear();
    window.localStorage.removeItem('encryptobox_client_id');

    // 4. Overwrite cookie footprints
    document.cookie.split(';').forEach((c) => {
      document.cookie = c
        .replace(/^ +/, '')
        .replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
    });

    // 5. Hard redirect to a decoy site
    window.location.replace('https://www.google.com');
  };

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
      const p2pCount = Object.keys(dcsRef.current).length;
      if (transportMode === 'p2p' && p2pCount > 0) {
        const peerSocketIds = Object.keys(dcsRef.current);
        const msgId = `p2p:${roomData.roomId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
        
        peerSocketIds.forEach(async (peerSocketId) => {
          const dc = dcsRef.current[peerSocketId];
          if (dc && dc.readyState === 'open') {
            try {
              const encryptedPayload = await encryptP2P(peerSocketId, messageText);
              const p2pMessage = {
                id: msgId,
                roomId: roomData.roomId,
                senderId: clientId,
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
                ttl: ttlSeconds,
                ...encryptedPayload
              };
              dc.send(JSON.stringify(p2pMessage));
            } catch (err) {
              console.error(`Failed to encrypt/send P2P message to peer ${peerSocketId}:`, err);
            }
          }
        });
        
        const localMessage = {
          id: msgId,
          roomId: roomData.roomId,
          senderId: clientId,
          timestamp: new Date().toISOString(),
          expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          ttl: ttlSeconds,
          decryptedText: messageText
        };
        setP2pMessages((prev) => [...prev, localMessage]);
      } else {
        // Fallback to relay
        const { encryptMessage } = await import('../utils/crypto');
        const encryptedData = await encryptMessage(messageText, password);
        await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, ttlSeconds);
        await loadMessages();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendAttachmentMeta = async (meta) => {
    const ttlSeconds = Math.floor((meta.ttlMs || 300000) / 1000);
    const p2pCount = Object.keys(dcsRef.current).length;

    if (transportMode === 'p2p' && p2pCount > 0) {
      const peerSocketIds = Object.keys(dcsRef.current);
      const msgId = `p2p:${roomData.roomId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const payloadString = JSON.stringify({ __attachment: true, ...meta });

      peerSocketIds.forEach(async (peerSocketId) => {
        const dc = dcsRef.current[peerSocketId];
        if (dc && dc.readyState === 'open') {
          try {
            const encryptedPayload = await encryptP2P(peerSocketId, payloadString);
            const p2pMessage = {
              id: msgId,
              roomId: roomData.roomId,
              senderId: clientId,
              timestamp: new Date().toISOString(),
              expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
              ttl: ttlSeconds,
              ...encryptedPayload
            };
            dc.send(JSON.stringify(p2pMessage));
          } catch (err) {
            console.error(`Failed to encrypt/send P2P attachment metadata to ${peerSocketId}:`, err);
          }
        }
      });
      
      const localMessage = {
        id: msgId,
        roomId: roomData.roomId,
        senderId: clientId,
        timestamp: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        ttl: ttlSeconds,
        decryptedText: payloadString
      };
      setP2pMessages((prev) => [...prev, localMessage]);
    } else {
      const { encryptMessage } = await import('../utils/crypto');
      const payload = JSON.stringify({ __attachment: true, ...meta });
      const encryptedData = await encryptMessage(payload, password);
      await messageAPI.sendMessage(roomData.roomId, { ...encryptedData, senderId: clientId }, ttlSeconds);
      await loadMessages();
    }
  };

  const handleDecryptMessage = async (encryptedMessage) => {
    if (encryptedMessage.decryptedText) {
      return encryptedMessage.decryptedText;
    }

    if (!password) return null;

    try {
      const { decryptMessage } = await import('../utils/crypto');
      return await decryptMessage(encryptedMessage, password);
    } catch (err) {
      console.error('Decryption error:', err);
      return '❌ Failed to decrypt message';
    }
  };

  // Merge and sort messages from Redis and P2P
  const allMessages = React.useMemo(() => {
    const merged = [...messages, ...p2pMessages];
    const seen = new Set();
    const result = [];
    for (const msg of merged) {
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        result.push(msg);
      }
    }
    return result.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [messages, p2pMessages]);

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
    <div className="relative max-w-6xl mx-auto">
      {/* Security Focus Shield Overlay */}
      {!isWindowFocused && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl transition-all duration-300 p-6">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6 animate-pulse">
            <span className="text-4xl">🔒</span>
          </div>
          <h2 className="text-2xl font-bold text-red-500 mb-2 tracking-wider">SECURITY SHIELD ACTIVE</h2>
          <p className="text-gray-400 text-xs text-center max-w-md font-mono">
            Window focus lost. Local forensic screen obfuscation active. Re-focus window to resume operation.
          </p>
        </div>
      )}

      <div className={!isWindowFocused ? 'blur-2xl pointer-events-none select-none' : ''}>
        <div className="max-w-6xl mx-auto">
        <PasswordTipModal isOpen={showPasswordTip} onClose={() => { setShowPasswordTip(false); sessionStorage.setItem('password_tip_dismissed', '1'); }} />
      
      {/* Room Header */}
      <div className="card p-6 mb-6 glow-effect">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <span className="text-2xl">💬</span>
            </div>
            <div className="text-left">
              <h2 className="text-2xl font-bold neon-text mb-1">
                Secure Chat Room
              </h2>
              <div className="flex items-center space-x-3 text-xs text-gray-400">
                <span 
                  className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    navigator.clipboard.writeText(roomData.roomId);
                    alert('Room ID copied to clipboard!');
                  }}
                  title="Click to copy full Room ID"
                >
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full"></span>
                  <span className="font-mono text-primary-300">{roomData.roomId.slice(0, 8)}...</span>
                  <svg className="w-3 h-3 text-gray-500 hover:text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-gray-600">•</span>
                <span>{allMessages.length} messages</span>
                <span className="text-gray-600">•</span>
                <span className={`font-mono font-semibold ${roomCountdown !== null && roomCountdown < 60000 ? 'text-red-500 animate-pulse' : 'text-red-400'}`}>🔥 {formatCountdown(roomCountdown)}</span>
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
            <button
              onClick={triggerPanicKill}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs tracking-wider uppercase shadow-lg shadow-red-600/20 border border-red-500/30 transition-all hover:scale-[1.02]"
            >
              🚨 PANIC (Ctrl+Q)
            </button>
          </div>
        </div>
      </div>

      {/* State Integrity Warning / Badge */}
      <div className={`mb-6 p-4 rounded-xl border backdrop-blur-md transition-all duration-500 animate-slide-up ${
        transportMode === 'p2p'
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/5'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/5'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${transportMode === 'p2p' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
              {transportMode === 'p2p' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wider uppercase flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${transportMode === 'p2p' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {transportMode === 'p2p' ? 'Direct P2P Link Active' : 'Relay Fallback Active'}
              </div>
              <p className="text-xs mt-1 text-gray-300">
                {transportMode === 'p2p'
                  ? 'All communications are routing directly peer-to-peer. Zero server payload storage or transport metadata footprint.'
                  : '⚠️ Downgrade Warning: Direct connection not established. Routing encrypted payloads asynchronously via centralized Redis. Room metadata footprint is exposed on server.'}
              </p>
            </div>
          </div>
          {transportMode === 'relay' && (
            <div className="flex-shrink-0">
              <span className="text-[10px] uppercase font-mono px-2 py-1 bg-amber-500/10 border border-amber-500/25 rounded-md text-amber-300 animate-pulse">
                NAT TRAVERSAL / WAITING
              </span>
            </div>
          )}
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
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-6 items-stretch">
        {/* Messages */}
        <div className="card p-6 min-h-[65vh] flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></span>
              Messages
            </h3>
            <span className="text-xs text-gray-500">{allMessages.length} total</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <MessageList 
              messages={allMessages}
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

        {/* Message Input */}
        <div className="card p-6 flex flex-col h-full">
          <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Message
          </h3>
          <div className="flex-1">
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

      {/* Ephemeral Vault */}
      <div className="mt-6 card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Ephemeral Vault
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-semibold px-2 py-1 rounded-lg border ${roomCountdown !== null && roomCountdown < 60000 ? 'text-red-400 border-red-500/30 bg-red-500/10 animate-pulse' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'}`}>
              🔥 Burns in: {formatCountdown(roomCountdown)}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-amber-500/20 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400">🔑</span>
              <span className="text-sm font-semibold text-gray-300">Session Keys</span>
            </div>
            <p className="text-xs text-gray-500">Ephemeral ECDH keys rotate after every message. All keys are destroyed when the room burns.</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Active</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-amber-500/20 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400">📎</span>
              <span className="text-sm font-semibold text-gray-300">Encrypted Files</span>
            </div>
            <p className="text-xs text-gray-500">All file attachments are encrypted client-side with AES-256-GCM and auto-expire with the room.</p>
            <div className="mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] text-primary-400 uppercase font-semibold">{transportMode === 'p2p' ? 'P2P Transfer' : 'Relay Vault'}</span>
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-amber-500/20 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400">🛡️</span>
              <span className="text-sm font-semibold text-gray-300">Transport Security</span>
            </div>
            <p className="text-xs text-gray-500">All traffic is padded to 4096 bytes and encrypted end-to-end. Zero plaintext exposure.</p>
            <div className="mt-2 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${transportMode === 'p2p' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className={`text-[10px] uppercase font-semibold ${transportMode === 'p2p' ? 'text-emerald-400' : 'text-amber-400'}`}>{transportMode === 'p2p' ? 'Direct P2P' : 'Relay Fallback'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
      </div>
    </div>
  );
};

export default ChatRoom;
