const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const roomRoutes = require('./routes/rooms');
const messageRoutes = require('./routes/messages');
const attachmentRoutes = require('./routes/attachments');
const vaultRoutes = require('./routes/vault');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit message sending to 30 per minute
  message: 'Too many messages sent, please slow down.',
});

const roomLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit room creation to 5 per hour
  message: 'Too many rooms created, please try again later.',
});

// Apply rate limiting
app.use('/api/', limiter);
// Message rate limiting will be applied in the route handler
// Room creation rate limiting
app.post('/api/rooms', roomLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', messageRoutes);
app.use('/api/rooms', attachmentRoutes);
app.use('/api/rooms', vaultRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler - temporarily disabled due to Express version compatibility
// app.all('*', (req, res) => {
//   res.status(404).json({ error: 'Route not found' });
// });

// Initialize Redis connection
const redisClient = require('./utils/db');

async function startServer() {
  try {
    // Connect to Redis
    await redisClient.connect();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
