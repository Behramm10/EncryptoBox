# 🔐 EncryptoBox — Self-Destructing Encrypted Messaging

> **Live Demo**: [encryptobox.vercel.app](https://encryptobox.vercel.app)

A secure, ephemeral messaging application where all encryption happens on the client device. The server only ever stores ciphertext — it never sees your messages or passwords.

---

## 🚀 Features

- **AES-256-GCM End-to-End Encryption** — messages encrypted before leaving the browser
- **Zero-Knowledge Architecture** — server cannot decrypt anything; passwords never transmitted
- **Self-Destructing Messages** — per-message TTL (30s · 5m · 1h · 24h)
- **Configurable Room Duration** — choose 30m / 1h / 6h / 24h when creating a room
- **Extend Session** — add +30m / +1h / +6h to an active room (capped at 24h total)
- **Smart TTL Capping** — message and file TTLs cannot exceed the room's remaining time
- **Auto-Burn Rooms** — room and all messages deleted when the last member leaves
- **Encrypted File Sharing** — any file format (.docx, .zip, .mp3, etc.) encrypted client-side with TTL
- **Zero-Knowledge Vault** — temporary encrypted file vault (ciphertext only)
- **HMAC Invite Links** — stateless signed invite tokens with expiry + one-click copy button
- **Room Password Protection** — key derived via PBKDF2, never leaves the browser
- **QR Code Invites** — scan to join on mobile
- **Dark / Light Mode** — system-aware with manual toggle, all dropdowns themed
- **Rate Limiting + Helmet** — DDoS protection and secure headers

---

## 🏗️ Architecture

```
User Browser
    │
    ├──► Vercel CDN      — React frontend (static)
    │        │
    └──► Render          — Node.js + Express API
              │
              └──► Upstash Redis — ephemeral encrypted storage (TTL auto-expiry)
```

### Security Model
| Layer | What happens |
|---|---|
| Encryption | AES-256-GCM in browser via Web Crypto API |
| Key derivation | PBKDF2 (100k iterations) from room password |
| Room auth | bcrypt-hashed PIN stored in Redis |
| Invites | HMAC-SHA256 signed tokens, stateless |
| Server storage | Ciphertext only, auto-expires via Redis TTL |

---

## 📁 Project Structure

```
EncryptoBox/
├── backend/
│   ├── server.js              # Express app entry
│   ├── routes/
│   │   ├── rooms.js           # Room CRUD, join, invite, leave/auto-burn, extend session
│   │   ├── messages.js        # Send & fetch encrypted messages
│   │   ├── attachments.js     # Encrypted file upload/download (any format)
│   │   └── vault.js           # Zero-knowledge vault
│   ├── utils/
│   │   ├── db.js              # ioredis client & all Redis operations
│   │   └── attachmentStore.js # In-memory attachment buffer
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── RoomCreator.js         # Welcome page (create / join / room TTL picker)
│   │   │   ├── ChatRoom.js            # Chat interface + room info bar + extend session
│   │   │   ├── MessageList.js         # Decrypt & render messages
│   │   │   ├── MessageInput.js        # Compose + TTL picker (capped by room TTL)
│   │   │   ├── PasswordPrompt.js      # Room password entry
│   │   │   ├── QRModal.js             # QR code invite + copy link button
│   │   │   ├── AttachmentUploader.js  # Client-side file encryption (any format, TTL capped)
│   │   │   └── AttachmentViewer.js    # Client-side file decryption + preview/download
│   │   ├── contexts/
│   │   │   └── ToastContext.js        # Global toast notifications
│   │   ├── utils/
│   │   │   ├── api.js                 # Axios API client
│   │   │   └── crypto.js              # AES-GCM / PBKDF2 helpers
│   │   ├── App.js
│   │   └── index.css                  # Tailwind + custom theme
│   ├── vercel.json                    # SPA routing fallback
│   ├── Dockerfile
│   └── package.json
│
├── render.yaml                        # Render IaC deployment config
└── README.md
```

---

## 🌐 Deployment

| Service | Provider | URL |
|---|---|---|
| Frontend | Vercel (free) | [encryptobox.vercel.app](https://encryptobox.vercel.app) |
| Backend API | Render (free) | [encryptobox.onrender.com](https://encryptobox.onrender.com) |
| Redis | Upstash (free) | Managed — 10k req/day |

> **Note:** Render free tier sleeps after 15 min of inactivity. First request after idle takes ~30–60s to wake up.

---

## 🛠️ Running Locally

### Prerequisites
- Node.js 18+
- Redis running locally (`redis-server`) **or** an Upstash URL

### 1. Clone
```bash
git clone https://github.com/Behramm10/EncryptoBox.git
cd EncryptoBox
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # fill in your values
npm install
npm run dev            # starts on http://localhost:3001
```

**Backend `.env`:**
```
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
INVITE_SECRET=your-random-secret
ATTACHMENT_SECRET=your-random-secret
VAULT_SECRET=your-random-secret
```

### 3. Frontend
```bash
cd frontend
echo "REACT_APP_API_URL=http://localhost:3001/api" > .env
npm install
npm start              # starts on http://localhost:3000
```

---

## 🔐 Environment Variables

### Backend (Render)
| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | `production` or `development` |
| `FRONTEND_URL` | Allowed CORS origin |
| `REDIS_URL` | Redis connection URL (`rediss://` for TLS) |
| `INVITE_SECRET` | HMAC secret for invite tokens |
| `ATTACHMENT_SECRET` | HMAC secret for attachment tokens |
| `VAULT_SECRET` | HMAC secret for vault tokens |

### Frontend (Vercel)
| Variable | Description |
|---|---|
| `REACT_APP_API_URL` | Backend API base URL |

---

## 🔒 Security Notes

- All cryptographic operations use the **Web Crypto API** (native browser)
- Messages are encrypted to **AES-256-GCM** with a key derived from the room password via **PBKDF2 (100,000 iterations)**
- Room passwords are **never sent to the server**
- The server stores only **ciphertext blobs** and **bcrypt-hashed PINs**
- File attachments of **any format** are encrypted client-side; server only sees ciphertext
- Rooms auto-burn when the last member leaves
- Message and file TTLs are **always ≤ room TTL** — enforced in the UI

---

## 📄 License

MIT
