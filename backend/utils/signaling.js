const socketIo = require('socket.io');

/**
 * Initializes the Socket.io signaling server.
 * Coordinates WebRTC connection handshakes between clients in the same room.
 * Does not log or store any signaling data (SDP, ICE candidates).
 * 
 * @param {import('http').Server} server - The HTTP server instance
 */
function initSignaling(server) {
  const io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Track connection metadata: socket.id -> { roomId, clientId }
  const socketRegistry = new Map();

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // When a peer joins the signaling channel for a room
    socket.on('join-room', ({ roomId, clientId }) => {
      if (!roomId || !clientId) {
        console.log(`⚠️ Missing roomId or clientId on join-room:`, { roomId, clientId });
        return;
      }

      console.log(`👤 Client ${clientId.substring(0, 8)}... joined signaling room: ${roomId}`);
      socket.roomId = roomId;
      socket.clientId = clientId;
      socketRegistry.set(socket.id, { roomId, clientId });

      const socketRoomId = `signaling:${roomId}`;
      socket.join(socketRoomId);

      // Fetch other peers currently in this signaling room
      const clientsInRoom = Array.from(io.sockets.adapter.rooms.get(socketRoomId) || []);
      const peers = [];

      for (const socketId of clientsInRoom) {
        if (socketId !== socket.id) {
          const peerInfo = socketRegistry.get(socketId);
          if (peerInfo) {
            peers.push({
              socketId,
              clientId: peerInfo.clientId
            });
          }
        }
      }

      // 1. Send the newly joined socket the list of peers already present in the room
      socket.emit('room-peers', peers);

      // 2. Notify existing peers that a new node has joined
      socket.to(socketRoomId).emit('peer-joined', {
        socketId: socket.id,
        clientId: clientId
      });
    });

    // Relay WebRTC signaling payloads (SDP Offer/Answer, ICE Candidates) directly to the target peer
    socket.on('signal', ({ targetSocketId, signalData }) => {
      if (!targetSocketId || !signalData) {
        console.log(`⚠️ Invalid signal payload from socket: ${socket.id}`);
        return;
      }

      const senderInfo = socketRegistry.get(socket.id);
      if (!senderInfo) {
        console.log(`⚠️ Sender info not registered for socket: ${socket.id}`);
        return;
      }

      console.log(`📡 Signaling Relay: ${senderInfo.clientId.substring(0, 8)} -> ${targetSocketId.substring(0, 8)} (Type: ${signalData.type})`);
      // Secure relay: Forward signal to target without storing or logging the data
      io.to(targetSocketId).emit('signal', {
        senderSocketId: socket.id,
        senderClientId: senderInfo.clientId,
        signalData
      });
    });

    // Handle connection termination
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      const info = socketRegistry.get(socket.id);
      if (info) {
        console.log(`👤 Client ${info.clientId.substring(0, 8)}... left signaling room: ${info.roomId}`);
        socketRegistry.delete(socket.id);
        const socketRoomId = `signaling:${info.roomId}`;
        
        // Notify remaining peers
        socket.to(socketRoomId).emit('peer-left', {
          socketId: socket.id,
          clientId: info.clientId
        });
      }
    });
  });

  return io;
}

module.exports = initSignaling;
