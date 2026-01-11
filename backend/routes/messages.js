const express = require('express');
const rateLimit = require('express-rate-limit');
const redisClient = require('../utils/db');
const { validateMessage } = require('../middleware/validation');

const router = express.Router();

// Message rate limiter
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit message sending to 30 per minute
  message: 'Too many messages sent, please slow down.',
});

// POST /api/rooms/:id/messages - Send a message to a room
router.post('/:id/messages', messageLimiter, validateMessage, async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { ciphertext, iv, salt, authTag, senderId, ttl } = req.body;
    
    // Check if room exists
    const roomExists = await redisClient.roomExists(roomId);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    // Store encrypted message
    const messageData = {
      ciphertext,
      iv,
      // Store salt if provided by client-side PBKDF2; authTag is optional/unused for Web Crypto ciphertexts
      ...(salt ? { salt } : {}),
      ...(authTag ? { authTag } : {}),
      ...(senderId ? { senderId } : {}),
      ttl
    };
    
    const message = await redisClient.addMessage(roomId, messageData, ttl);
    
    console.log(`📨 Message added to room ${roomId}: ${message.id}`);
    
    res.status(201).json({
      success: true,
      message: {
        id: message.id,
        roomId: message.roomId,
        timestamp: message.timestamp,
        expiresAt: message.expiresAt,
        ttl: message.ttl
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// GET /api/rooms/:id/messages - Get all messages in a room
router.get('/:id/messages', async (req, res) => {
  try {
    const { id: roomId } = req.params;
    
    // Check if room exists
    const roomExists = await redisClient.roomExists(roomId);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    // Get all messages for the room
    const messages = await redisClient.getMessages(roomId);
    
    // Clean up expired messages
    await redisClient.cleanupExpiredMessages(roomId);
    
    // Return only the encrypted data (no decryption on server)
    const encryptedMessages = messages.map(msg => ({
      id: msg.id,
      roomId: msg.roomId,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      // Include salt so clients can derive the same key for decryption
      ...(msg.salt ? { salt: msg.salt } : {}),
      authTag: msg.authTag,
      senderId: msg.senderId,
      timestamp: msg.timestamp,
      expiresAt: msg.expiresAt,
      ttl: msg.ttl
    }));
    
    console.log(`📥 Retrieved ${encryptedMessages.length} messages from room ${roomId}`);
    
    res.json({
      success: true,
      messages: encryptedMessages,
      count: encryptedMessages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// DELETE /api/rooms/:id/messages/:messageId - Delete a specific message (optional)
router.delete('/:id/messages/:messageId', async (req, res) => {
  try {
    const { id: roomId, messageId } = req.params;
    
    // Check if room exists
    const roomExists = await redisClient.roomExists(roomId);
    if (!roomExists) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    // Delete the message
    await redisClient.deleteMessage(messageId);
    
    console.log(`🗑️ Message deleted: ${messageId} from room ${roomId}`);
    
    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

module.exports = router;
