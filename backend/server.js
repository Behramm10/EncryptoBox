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

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 100, message: 'Too many requests from this IP, please try again later.', standardHeaders: true, legacyHeaders: false });
const messageLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30, message: 'Too many messages sent, please slow down.' });
const roomLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many rooms created, please try again later.' });

app.use('/api/', limiter);
app.post('/api/rooms', roomLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/rooms', roomRoutes);
app.use('/api/rooms', messageRoutes);
app.use('/api/rooms', attachmentRoutes);
app.use('/api/rooms', vaultRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const redisClient = require('./utils/db');

async function startServer() {
  try {
    await redisClient.connect();
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
