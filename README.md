# 🔐 EncryptoBox - Ephemeral Zero-Trust Messaging Platform

**Live Application**: [https://encryptobox.vercel.app](https://encryptobox.vercel.app)  
**Author**: [Behram Umrigar (Behramm10)](https://github.com/Behramm10)

EncryptoBox is a state-of-the-art, self-destructing secure communication platform designed for zero-trust environments. By implementing a **hybrid WebRTC peer-to-peer (P2P) transport with automatic Redis-backed relay fallbacks**, and using strictly **native Web Crypto APIs** (zero external cryptographic libraries), EncryptoBox ensures that plaintext and encryption keys never leave the operator's browser. 

The system features 4096-byte network traffic padding, end-to-end Double Ratchet encryption, and a hardened **Anti-Forensics Security Shield** to defend against local forensic memory scraping, physical display capture, and inspect-source node tree analysis.

---

## 🚀 Key Features

### 📡 Hybrid Transport Engine
- **WebRTC RTCDataChannel P2P**: Direct browser-to-browser communication bypassing servers completely, resulting in a zero server-payload footprint.
- **Automated Signaling Relay**: Socket.io coordinates ICE candidate and SDP exchanges without logging or persisting signal metadata.
- **Redis-Backed Relay Fallback**: Automatically and transparently routes encrypted traffic through Redis if NAT traversal/P2P fails.
- **Connection Integrity Banners**: Instant visual cues (Green for direct P2P, Amber for Relay Mode) inform operators of their transport security state in real-time.

### 🔑 Double Ratchet Cryptography (Signal-style)
- **Zero Library Footprint**: Relies 100% on native W3C Web Crypto API (`window.crypto.subtle`) to eliminate supply-chain vulnerability vectors.
- **Mathematical Forward Secrecy**: 
  - **Symmetric Ratchet**: Rotates message transmission keys on every packet sent/received using SHA-256 HKDF and AES-GCM-256.
  - **Asymmetric Ratchet**: Executes an ECDH key exchange upon receiving new Diffie-Hellman public key frames from the peer.
- **Password-Derived Keys**: Local PBKDF2 (100,000 iterations) derives credentials for initial channel verification without ever transmitting the password to the server.
- **4096-Byte Traffic Obfuscation Padding**: Pads all plaintexts to exactly 4096 bytes with random bytes and a null-delimiter before encryption. Passive network sniffers see identical packet sizes, neutralizing traffic-analysis attacks.


### 🛡️ Advanced Anti-Forensics Shield
- **Canvas-Based Message Rendering**: Draws message text directly onto HTML5 `<canvas>` elements instead of injecting raw string nodes into the DOM, making it impossible for browser extensions, page-scrapers, or DevTools element tree viewers to read chat text.
- **Forensic Focus Blur & Lock Screen**: Instantly overlays a `SECURITY SHIELD ACTIVE` lock screen and blurs the main chat using heavy CSS filters (`blur-2xl`) whenever the tab loses focus or the window is switched.
- **Inspector & Keyboard Suppressions**: Suppresses mouse right-clicks and intercepts dev shortcuts (`F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+U`) to prevent inspection.
- **Zero-Footprint Panic Kill Switch**: Pressing `Ctrl + Q` (or clicking the red **🚨 PANIC** button) initiates an instant crypto-shredding loop that overwrites Double Ratchet secrets, wipes React state, clears localStorage/sessionStorage/cookies, and redirects the browser page to a clean history decoy (`google.com`).

### ⏱️ Ephemeral Auto-Burn & TTL
- **Customizable Room TTL**: Set room lifespans from 5 minutes to 24 hours at creation time.
- **Ticking Auto-Burn Timer**: Shows a live ticking countdown (`🔥 HH:MM:SS`) in the chat room header; auto-destructs and kicks participants the second it hits zero.
- **Message-Level TTL**: Expire individual messages in 30 seconds, 5 minutes, 1 hour, or 24 hours.

### 📂 Ephemeral Vault Dashboard
- A 3-column dashboard located directly below the chat window displaying:
  - **Session Keys Status**: Real-time visualization of ECDH asymmetric key ratcheting.
  - **Encrypted Files Status**: Tracking distribution and security states of uploaded files.
  - **Transport Security Mode**: Displays connection type (Direct P2P or Relay Fallback).

---

## 🏗️ Architecture

```
                                 ┌───────────────────────┐
                                 │  WebRTC Signaling     │
                                 │  (Socket.io Server)   │
                                 └───────────┬───────────┘
                                             │ (SDP / ICE)
                                             ▼
  ┌────────────────────────┐            ┌─────────┐            ┌────────────────────────┐
  │   Operator Client A    ├───────────►│ WebRTC  │◄───────────┤   Operator Client B    │
  │                        │            │  P2P    │            │                        │
  │ • Double Ratchet ECDH  │◄───────────┤ Channel ├───────────►│ • Double Ratchet ECDH  │
  │ • Canvas Text Renderer │            └─────────┘            │ • Canvas Text Renderer │
  │ • Focus Blur Masking   │                                   │ • Focus Blur Masking   │
  └───────────┬────────────┘                                   └───────────┬────────────┘
              │ (Relay fallback)                                           │ (Relay fallback)
              ▼                                                            ▼
  ┌────────────────────────┐            ┌─────────┐            ┌────────────────────────┐
  │   Node.js Express API  ├───────────►│  Redis  │◄───────────┤   Node.js Express API  │
  │  (Rate Limiting/Joi)   │            │  Store  │            │  (Rate Limiting/Joi)   │
  └────────────────────────┘            └─────────┘            └────────────────────────┘
```

---

## 📁 Project Structure

```
EncryptoBox/
├── docker-compose.yml       # Complete environment orchestrator
├── backend/                 # Node.js Server & Relays
│   ├── server.js            # Express server & socket listener
│   ├── Dockerfile           # Backend container spec
│   ├── routes/
│   │   ├── rooms.js         # Room metadata & invites
│   │   ├── messages.js      # Message relay & TTL management
│   │   ├── attachments.js   # Ephemeral file attachments
│   │   └── vault.js         # Zero-knowledge file vault APIs
│   ├── middleware/
│   │   └── validation.js    # Joi request schema validation
│   └── utils/
│       ├── db.js            # Redis client & key operations
│       ├── attachmentStore.js # Ephemeral node storage & sweepers
│       └── signaling.js     # WebRTC signaling relay handlers
│
├── frontend/                # React Cryptographic Client
│   ├── src/
│   │   ├── App.js           # Core layout, copy handlers, dark mode toggle
│   │   ├── index.js         # Entrypoint
│   │   ├── index.css        # Layout grid, visual styling tokens, animations
│   │   ├── components/
│   │   │   ├── RoomCreator.js      # Configuration dashboard (TTL & Room Creation)
│   │   │   ├── PasswordPrompt.js   # Client-side derived keys & offline hints
│   │   │   ├── ChatRoom.js         # RTCDataChannel manager & Double Ratchet hook
│   │   │   ├── MessageInput.js     # Chat input with individual TTL selector
│   │   │   ├── MessageList.js      # Decrypts payload & prints to Canvas
│   │   │   ├── AntiForensicText.js # HTML5 Canvas-based text renderer
│   │   │   ├── AttachmentUploader.js # GCM encryptor & file uploader
│   │   │   ├── AttachmentViewer.js # File decryptor & preview injector
│   │   │   ├── PasswordTipModal.js # UI Modal for password safety tip
│   │   │   └── VaultPanel.js       # Ephemeral Vault component for file storage
│   │   └── utils/
│   │       ├── crypto.js    # Double Ratchet hook, GCM encryptors, KDF & Padding
│   │       └── api.js       # API client config
│   └── Dockerfile           # Frontend container spec
└── README.md                # This documentation
```

---

## 🛠️ Installation & Setup

You can run EncryptoBox either using Docker Compose (recommended) or setting up the servers manually.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Redis](https://redis.io/) (v7.0 or higher)

---

### Option A: Quickstart with Docker Compose

Ensure Docker and Docker Compose are installed and running on your host machine. From the root of the project, execute:

```bash
# Build and start all services (Frontend, Backend, Redis)
docker-compose up --build
```

- **Frontend Interface**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001`
- **Redis Cache**: Port `6379` (Internal to Compose network)

To stop the services, press `Ctrl + C` or run:
```bash
docker-compose down
```

---

### Option B: Manual Installation

#### 1. Start Redis
Make sure Redis is running on port `6379`:
- **macOS**: `brew services start redis`
- **Linux**: `sudo systemctl start redis-server`
- **Windows**: Start the Memurai service or run `redis-server` inside WSL.

#### 2. Backend Setup
Navigate to the `backend` directory, install dependencies, configure environment variables, and start the development server:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` folder:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
INVITE_SECRET=change-this-to-a-secure-hmac-key
ATTACHMENT_SECRET=change-this-to-another-secure-key
ATTACHMENT_MAX_BYTES=10485760
```

Start the server:
```bash
npm run dev
```

#### 3. Frontend Setup
Open a new terminal, navigate to the `frontend` directory, install dependencies, configure environment variables, and start the React application:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend/` folder:
```env
REACT_APP_API_URL=http://localhost:3001/api
```

Start the application:
```bash
npm start
```

The app will launch at `http://localhost:3000`.

---

## 📡 API Endpoints Reference

### Rooms Management
- `POST /api/rooms` - Create a room.
  - Body: `{ maxMembers: number, ttlMs: number }`
- `GET /api/rooms/:id` - Check if room exists and retrieve active metadata.
- `DELETE /api/rooms/:id` - Delete a room.

### Messages & Relay
- `POST /api/rooms/:id/messages` - Post GCM encrypted message ciphertext.
- `GET /api/rooms/:id/messages` - Retrieve room messages.
- `DELETE /api/rooms/:id/messages/:messageId` - Delete specific message.

### Ephemeral Attachments
- `POST /api/rooms/:roomId/attachments/init` - Initialize file upload ticket.
- `PUT /api/rooms/:roomId/attachments/:id` - Stream encrypted file bytes.
- `GET /api/rooms/:roomId/attachments/:id` - Download encrypted file bytes.

### Zero-Knowledge Vault
- `POST /api/rooms/:roomId/vault/init` - Initialize a vault storage spot.
- `PUT /api/rooms/:roomId/vault/:id` - Upload vault file bytes.
- `GET /api/rooms/:roomId/vault/:id` - Retrieve vault file bytes.
- `POST /api/rooms/:roomId/vault/:id/delete` - Remove vault item.

---

## 🛡️ Security Specifications & Protocols

### Cryptographic Primitive Stack
- **Symmetric Encryption**: AES-GCM-256 via native browser Web Crypto API.
- **Key Derivation (Initial)**: PBKDF2 with 100,000 iterations using SHA-256 and a cryptographically random 16-byte salt generated per-message.
- **Ephemeral Key Exchange**: ECDH (Elliptic Curve Diffie-Hellman) utilizing the `P-256` curve.
- **Key Derivation Function (KDF)**: HKDF-SHA256 used for symmetric and asymmetric key steps.

### Obfuscated Packet Size (Traffic Analysis Protection)
To neutralize passive traffic-analysis attacks, EncryptoBox regularizes all network packet sizes:
1. **Unpadded Plaintext**: The raw message payload.
2. **Padding Step**: Helper pads the payload with a `\0` null-delimiter and appends random noise bytes to reach exactly `4096` bytes.
3. **Encryption Step**: AES-GCM-256 encrypts the standardized block.
4. **Network Frame**: The transmitted packet is always of a constant size, hiding the length of the actual communication.

### Panic Switch Crypto-Shredding Details
The Panic Kill Switch (`Ctrl + Q`) ensures forensic data recovery fails by overwriting volatile memory key pools:
- Clears the Double Ratchet state hooks, rendering any intercepted network ciphertexts permanently indecipherable.
- Overwrites in-memory variables containing public keys, root keys, and derived session keys.
- Destroys active cookies by setting expiration time to `1970-01-01`.
- Calls `sessionStorage.clear()` and `localStorage.removeItem(...)`.
- Instantly triggers a hard window location replacement to decoy target `https://www.google.com`.

---

## 🧪 Verification Guidelines

To verify the security features of the application, follow these guidelines:

### 1. Canvas DOM Inspection (Anti-Forensics)
- Open DevTools, select the inspector element pointer, and hover over any decrypted chat message bubble.
- Verify that **no text strings** are present inside the DOM tree. The chat bubble should contain a `<canvas>` element containing rendered pixels rather than plain text nodes.

### 2. Visibility Guarding
- Open the application in two side-by-side browser windows.
- Click on window A to focus it. Observe that window B immediately blanks out with a `SECURITY SHIELD ACTIVE` block and blurs the screen behind it.
- Click back on window B; the interface will un-blur instantly.

### 3. Keyboard Shortcuts & Suppressions
- Press `F12`, `Ctrl + Shift + I`, `Ctrl + Shift + J`, or `Ctrl + U` on the chat page. Confirm that the browser blocks the shortcut.
- Right-click anywhere on the interface. Confirm that the default browser context menu does not appear.

### 4. Panic Shred test
- Open browser dev console (`Application` or `Storage` tab) and verify the existence of local keys and active messages.
- Press `Ctrl + Q`.
- Verify the page immediately redirects to Google. Inspect the local storage/session storage to confirm that all sensitive credentials have been completely wiped.
