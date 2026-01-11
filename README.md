# 🔐 EncryptoBox - Self-Destructing Encrypted Messaging

A secure, self-destructing messaging application where all encryption happens on the client side, and the server only stores encrypted ciphertext temporarily.

## 🚀 Features

- **Client-Side Encryption**: All messages and files are encrypted with AES-256-GCM before leaving your device
- **Self-Destructing Messages**: Per-message TTL (30s, 5m, 1h, 24h)
- **Ephemeral Attachments**: Encrypted images/PDFs with TTL; server stores ciphertext only
- **Zero‑Knowledge Vault**: Temporary encrypted file vault (ciphertext-only, TTL)
- **Expiring Invites**: Stateless HMAC tokens to generate time-limited invite links
- **Room-Based Chat**: Create or join secure chat rooms with unique IDs
- **Password Protection**: Room password never leaves the browser (derived key via PBKDF2)
- **Modern UI**: React + Tailwind; password tip to share secrets offline
- **Zero-Knowledge**: Server never sees plaintext or passwords
- **Dark Mode**: System-aware dark theme with manual toggle (NEW ✨)
- **Rate Limiting**: Protection against abuse and DDoS attacks (NEW ✨)
- **Input Validation**: Comprehensive validation with Joi (NEW ✨)

## 🏗️ Architecture

```
┌─────────────────┐    HTTPS     ┌─────────────────┐    Redis     ┌─────────────────┐
│   React Client  │◄────────────►│  Node.js Server │◄────────────►│   Redis Store   │
│                 │              │                 │              │                 │
│ • AES-256-GCM   │              │ • Express API   │              │ • Encrypted     │
│ • PBKDF2        │              │ • Rate Limiting │              │   Messages      │
│ • Web Crypto    │              │ • Validation    │              │ • TTL Auto-     │
│ • Password UI   │              │ • CORS/Helmet   │              │   Expiry        │
│ • Dark Mode     │              │ • No Plaintext  │              │                 │
└─────────────────┘              └─────────────────┘              └─────────────────┘
```

## 📁 Project Structure

```
encryptobox/
├── backend/                 # Node.js Express server
│   ├── server.js           # Main server entry point
│   ├── routes/
│   │   ├── rooms.js        # Room management, join, invites
│   │   ├── messages.js     # Message APIs (TTL)
│   │   ├── attachments.js  # Ephemeral attachments (init/upload/get/delete, tokens)
│   │   └── vault.js        # Zero-knowledge vault (ciphertext-only)
│   ├── utils/
│   │   ├── db.js           # Redis connection & operations
│   │   └── attachmentStore.js # In-memory buffer store + TTL sweeper
│   ├── .env                # Environment variables
│   └── package.json        # Backend dependencies
│
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── ChatRoom.js
│   │   │   ├── MessageInput.js        # TTL picker
│   │   │   ├── MessageList.js         # Decrypts & renders attachments
│   │   │   ├── AttachmentUploader.js  # Encrypts and uploads files
│   │   │   ├── AttachmentViewer.js    # Decrypts and previews/downloads
│   │   │   ├── PasswordPrompt.js      # Set/enter room password (client-only)
│   │   │   ├── PasswordTipModal.js    # Offline sharing tip
│   │   │   └── RoomCreator.js         # Create/join room (optional member cap)
│   │   ├── utils/
│   │   │   ├── crypto.js   # Client-side encryption
│   │   │   └── api.js      # API communication
│   │   ├── App.js          # Main React component
│   │   └── index.js        # React entry point
│   ├── .env                # Frontend environment
│   └── package.json        # Frontend dependencies
│
└── README.md               # This file
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v18 or higher)
- Redis server (Windows: Memurai Free recommended)
- npm or yarn

### 1. Clone and Setup

```bash
git clone <repository-url>
cd encryptobox
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
INVITE_SECRET=change-me
ATTACHMENT_SECRET=change-me-too
ATTACHMENT_MAX_BYTES=10485760
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:3001/api
```

### 4. Start Redis

Make sure Redis is running on your system:

```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis

# On Windows
# Option A: Memurai Free (recommended)
#   Install from https://www.memurai.com/ and ensure the Memurai service is Running
# Option B: WSL Ubuntu + redis-server
```

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 🔒 Security Features

### Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Salt**: Random 16-byte salt per message
- **IV**: Random 12-byte initialization vector per message

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Server Security
- **Helmet.js**: Security headers
- **CORS**: Configured for frontend origin
- **Rate Limiting**: Protection against abuse (100 req/min general, 30 msg/min, 5 rooms/hour)
- **Input Validation**: Joi-based validation for all endpoints
- **No Logging**: Plaintext and passwords are never logged
- **TTL**: Automatic message expiration

## 📡 API Endpoints

### Rooms
- `POST /api/rooms` - Create a new room
- `GET /api/rooms/:id` - Check if room exists
- `DELETE /api/rooms/:id` - Delete a room

### Messages
- `POST /api/rooms/:id/messages` - Send encrypted message
- `GET /api/rooms/:id/messages` - Get encrypted messages
- `DELETE /api/rooms/:id/messages/:messageId` - Delete specific message

### Health
- `GET /api/health` - API health check

## 🎯 Usage

1. **Create or Join Room**: Start by creating a new room or joining an existing one
2. **Set Password**: Create a strong password for the room (for new rooms) or enter the existing password
3. **Send Messages**: Type your message and it will be encrypted before sending
4. **Real-Time Chat**: Messages appear via polling (every 2 seconds) and auto-delete after TTL expires
5. **Share Room**: Share the room ID and password with others to let them join
6. **Dark Mode**: Toggle dark/light theme using the sun/moon icon in the header

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm start    # React development server with hot reload
```

### Building for Production
```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
npm start
```

## 🚀 Deployment

### Backend (Render/Heroku)
1. Set environment variables:
   - `PORT` (auto-set by platform)
   - `NODE_ENV=production`
   - `FRONTEND_URL=https://your-frontend-domain.com`
   - `REDIS_URL=your-redis-url`

### Frontend (Vercel/Netlify)
1. Set environment variable:
   - `REACT_APP_API_URL=https://your-backend-domain.com/api`
2. Build and deploy

### Redis (Production)
- Use Redis Cloud, AWS ElastiCache, or similar managed Redis service
- Ensure SSL/TLS encryption in transit
- Configure proper authentication

## 🧪 Testing

### Manual Testing
1. Create a room and verify room ID generation
2. Set a password and verify encryption works
3. Send messages and verify they appear encrypted on server
4. Verify messages auto-delete after TTL
5. Test with multiple users in same room

### Security Testing
- Verify no plaintext in server logs
- Check that passwords never reach the server
- Confirm messages are properly encrypted
- Test message expiration functionality

## 🔍 Troubleshooting

### Common Issues

**Redis Connection Error:**
```bash
# Check if Redis is running
redis-cli ping
# Should return "PONG"
```

**CORS Errors:**
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check that frontend is running on the expected port

**Encryption Errors:**
- Ensure you're using HTTPS in production
- Check browser console for Web Crypto API errors
- Verify password meets all requirements

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚠️ Security Notice

This is a demonstration project. For production use:
- Use HTTPS everywhere
- Implement proper authentication
- Add rate limiting
- Use a managed Redis service
- Regular security audits
- Keep dependencies updated

## 🆘 Support

If you encounter any issues:
1. Check the troubleshooting section
2. Review the browser console for errors
3. Check server logs for backend issues
4. Open an issue on GitHub

---

**Remember**: This app prioritizes security and privacy. All encryption happens on your device, and we never see your messages or passwords!
