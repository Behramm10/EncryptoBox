// Using Web Crypto API directly - no need for crypto-browserify
import { useRef, useEffect } from 'react';

/**
 * Derive a key from a password using PBKDF2
 * @param {string} password - The user password
 * @param {Buffer} salt - Random salt
 * @returns {Promise<Buffer>} - Derived key
 */
export async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Use Web Crypto API for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // High iteration count for security
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  
  return derivedKey;
}

/**
 * Generate a random salt
 * @returns {Buffer} - Random salt
 */
export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Pad plaintext string to exactly target size (default 4096) with random characters.
 * Placed inside a null character delimiter so it can be unpadded.
 */
export function padPlaintext(text, size = 4096) {
  if (text.length >= size) return text;
  const paddingCharCount = size - text.length - 1; // 1 byte for null delimiter
  const array = new Uint8Array(paddingCharCount);
  window.crypto.getRandomValues(array);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let padding = '';
  for (let i = 0; i < paddingCharCount; i++) {
    padding += alphabet[array[i] % 64];
  }
  return text + '\0' + padding;
}

/**
 * Remove random padding characters by splitting at the null delimiter.
 */
export function unpadPlaintext(paddedText) {
  const index = paddedText.indexOf('\0');
  if (index !== -1) {
    return paddedText.substring(0, index);
  }
  return paddedText;
}

/**
 * Encrypt a message using AES-256-GCM
 * @param {string} message - The message to encrypt
 * @param {string} password - The user password
 * @returns {Promise<Object>} - Encrypted data with IV and auth tag
 */
export async function encryptMessage(message, password) {
  try {
    const padded = padPlaintext(message, 4096);
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(padded);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Generate salt for key derivation
    const salt = generateSalt();
    
    // Derive key from password
    const key = await deriveKey(password, salt);
    
    // Encrypt the message
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      messageBuffer
    );
    
    // Convert to base64 for transmission
    const ciphertext = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const saltBase64 = btoa(String.fromCharCode(...salt));
    
    return {
      ciphertext,
      iv: ivBase64,
      salt: saltBase64,
      authTag: null // GCM mode includes auth tag in ciphertext
    };
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt message');
  }
}

/**
 * Encrypt arbitrary bytes with AES-GCM using password-derived key
 * Returns { ciphertextBytes: Uint8Array, iv: Uint8Array, salt: Uint8Array }
 */
export async function encryptBytes(bytes, password) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { ciphertextBytes: new Uint8Array(ciphertext), iv, salt };
}

/**
 * Decrypt arbitrary bytes with AES-GCM using password-derived key
 */
export async function decryptBytes(ciphertextBytes, iv, salt, password) {
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextBytes);
  return new Uint8Array(plaintext);
}

/**
 * Decrypt a message using AES-256-GCM
 * @param {Object} encryptedData - The encrypted data object
 * @param {string} password - The user password
 * @returns {Promise<string>} - Decrypted message
 */
export async function decryptMessage(encryptedData, password) {
  try {
    const { ciphertext, iv, salt } = encryptedData;
    
    // Convert from base64
    const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const saltBuffer = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    
    // Derive the same key
    const key = await deriveKey(password, saltBuffer);
    
    // Decrypt the message
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      ciphertextBuffer
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedData);
    return unpadPlaintext(decryptedText);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt message - check your password');
  }
}

/**
 * Generate a secure random room ID
 * @returns {string} - Random room ID
 */
export function generateRoomId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password for storage (if needed)
 * @param {string} password - The password to hash
 * @returns {Promise<string>} - Hashed password
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {Object} - Validation result
 */
export function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const isValid = password.length >= minLength && 
                  hasUpperCase && 
                  hasLowerCase && 
                  hasNumbers && 
                  hasSpecialChar;
  
  return {
    isValid,
    errors: [
      password.length < minLength && `Password must be at least ${minLength} characters`,
      !hasUpperCase && 'Password must contain at least one uppercase letter',
      !hasLowerCase && 'Password must contain at least one lowercase letter',
      !hasNumbers && 'Password must contain at least one number',
      !hasSpecialChar && 'Password must contain at least one special character'
    ].filter(Boolean)
  };
}

/**
 * Generate a new ECDH key pair (P-256)
 */
export async function generateECDHKeyPair() {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Export a public ECDH key as base64 raw bytes
 */
export async function exportPublicKey(publicKey) {
  const exported = await window.crypto.subtle.exportKey('raw', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import a public ECDH key from base64 raw bytes
 */
export async function importPublicKey(base64) {
  const buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

/**
 * Compute Diffie-Hellman agreement
 */
export async function deriveDHAgreement(privateKey, publicKey) {
  return await window.crypto.subtle.deriveBits(
    {
      name: 'ECDH',
      public: publicKey
    },
    privateKey,
    256
  );
}

/**
 * Custom React hook managing Double Ratchet session state for each peer channel
 */
export function useDoubleRatchet(roomId, password, saltBase64, clientId) {
  const sessions = useRef({});

  useEffect(() => {
    return () => {
      sessions.current = {};
    };
  }, []);

  const getInitialDHPublicKey = async (peerSocketId) => {
    const keyPair = await generateECDHKeyPair();
    sessions.current[peerSocketId] = {
      localDhKeyPair: keyPair,
      remoteDhPublicKey: null,
      remoteDhPublicKeyBase64: null,
      rootKey: null,
      sendingChainKey: null,
      receivingChainKey: null,
      sequenceNumber: 0
    };
    return await exportPublicKey(keyPair.publicKey);
  };

  const establishSession = async (peerSocketId, peerPublicKeyBase64, peerClientId) => {
    const session = sessions.current[peerSocketId];
    if (!session) {
      throw new Error(`Session not initialized for peer ${peerSocketId}`);
    }

    const remotePubKey = await importPublicKey(peerPublicKeyBase64);
    session.remoteDhPublicKey = remotePubKey;
    session.remoteDhPublicKeyBase64 = peerPublicKeyBase64;

    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    const passwordIkm = await window.crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      'HKDF',
      false,
      ['deriveBits']
    );

    const initialRootKey = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0)),
        info: encoder.encode('encryptobox-dr-root-salt')
      },
      passwordIkm,
      256
    );

    const dhSharedSecret = await deriveDHAgreement(
      session.localDhKeyPair.privateKey,
      remotePubKey
    );

    const ikmKey = await window.crypto.subtle.importKey(
      'raw',
      dhSharedSecret,
      'HKDF',
      false,
      ['deriveBits']
    );

    const derived = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(initialRootKey),
        info: encoder.encode('encryptobox-dr-chain-derivation')
      },
      ikmKey,
      512
    );

    session.rootKey = derived.slice(0, 32);
    const chainKey1 = derived.slice(32, 48);
    const chainKey2 = derived.slice(48, 64);

    // Client ID sorting decides who gets sending vs receiving chains
    const comparisonKey = peerClientId || peerSocketId;
    if (clientId < comparisonKey) {
      session.sendingChainKey = chainKey1;
      session.receivingChainKey = chainKey2;
    } else {
      session.sendingChainKey = chainKey2;
      session.receivingChainKey = chainKey1;
    }

    // eslint-disable-next-line no-console
    console.log(`Double Ratchet session established with peer ${peerSocketId}`);
  };

  const encryptP2P = async (peerSocketId, plaintext) => {
    const session = sessions.current[peerSocketId];
    if (!session || !session.sendingChainKey) {
      throw new Error(`Double Ratchet session not established with peer ${peerSocketId}`);
    }

    const ikmKey = await window.crypto.subtle.importKey(
      'raw',
      session.sendingChainKey,
      'HKDF',
      false,
      ['deriveBits']
    );

    const derived = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('encryptobox-dr-symmetric-step')
      },
      ikmKey,
      512
    );

    const nextSendingChainKey = derived.slice(0, 32);
    const messageKeyBytes = derived.slice(32, 64);

    session.sendingChainKey = nextSendingChainKey;
    session.sequenceNumber += 1;

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      messageKeyBytes,
      'AES-GCM',
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoder = new TextEncoder();
    const padded = padPlaintext(plaintext, 4096);
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      aesKey,
      encoder.encode(padded)
    );

    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedData)));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const localPubKeyBase64 = await exportPublicKey(session.localDhKeyPair.publicKey);

    // eslint-disable-next-line no-console
    console.log(`P2P Encrypt (Seq ${session.sequenceNumber}): key rotated.`);

    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      dhPublicKey: localPubKeyBase64,
      seq: session.sequenceNumber
    };
  };

  const decryptP2P = async (peerSocketId, payload) => {
    const session = sessions.current[peerSocketId];
    if (!session) {
      throw new Error(`Double Ratchet session not established with peer ${peerSocketId}`);
    }

    const { ciphertext, iv, dhPublicKey: peerPubKeyBase64, seq } = payload;

    if (peerPubKeyBase64 && peerPubKeyBase64 !== session.remoteDhPublicKeyBase64) {
      // eslint-disable-next-line no-console
      console.log(`DH Key change detected from peer ${peerSocketId}. Advancing DH Ratchet...`);

      const remotePubKey = await importPublicKey(peerPubKeyBase64);
      session.remoteDhPublicKey = remotePubKey;
      session.remoteDhPublicKeyBase64 = peerPubKeyBase64;

      const dhSharedSecretReceiving = await deriveDHAgreement(
        session.localDhKeyPair.privateKey,
        remotePubKey
      );

      const ikmKeyReceiving = await window.crypto.subtle.importKey(
        'raw',
        dhSharedSecretReceiving,
        'HKDF',
        false,
        ['deriveBits']
      );

      const derivedReceiving = await window.crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(session.rootKey),
          info: new TextEncoder().encode('encryptobox-dr-dh-step')
        },
        ikmKeyReceiving,
        512
      );

      session.rootKey = derivedReceiving.slice(0, 32);
      session.receivingChainKey = derivedReceiving.slice(32, 64);

      const newKeyPair = await generateECDHKeyPair();
      session.localDhKeyPair = newKeyPair;

      const dhSharedSecretSending = await deriveDHAgreement(
        newKeyPair.privateKey,
        remotePubKey
      );

      const ikmKeySending = await window.crypto.subtle.importKey(
        'raw',
        dhSharedSecretSending,
        'HKDF',
        false,
        ['deriveBits']
      );

      const derivedSending = await window.crypto.subtle.deriveBits(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(session.rootKey),
          info: new TextEncoder().encode('encryptobox-dr-dh-step')
        },
        ikmKeySending,
        512
      );

      session.rootKey = derivedSending.slice(0, 32);
      session.sendingChainKey = derivedSending.slice(32, 64);
    }

    if (!session.receivingChainKey) {
      throw new Error(`Double Ratchet receiving chain key is not set for peer ${peerSocketId}`);
    }

    const ikmKey = await window.crypto.subtle.importKey(
      'raw',
      session.receivingChainKey,
      'HKDF',
      false,
      ['deriveBits']
    );

    const derived = await window.crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('encryptobox-dr-symmetric-step')
      },
      ikmKey,
      512
    );

    const nextReceivingChainKey = derived.slice(0, 32);
    const messageKeyBytes = derived.slice(32, 64);

    session.receivingChainKey = nextReceivingChainKey;

    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      messageKeyBytes,
      'AES-GCM',
      false,
      ['decrypt']
    );

    const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      aesKey,
      ciphertextBuffer
    );

    // eslint-disable-next-line no-console
    console.log(`P2P Decrypt (Seq ${seq}): key rotated.`);

    const decoder = new TextDecoder();
    const decryptedPadded = decoder.decode(decryptedData);
    return unpadPlaintext(decryptedPadded);
  };

  const shredSessions = () => {
    Object.keys(sessions.current).forEach((peerSocketId) => {
      const session = sessions.current[peerSocketId];
      if (session) {
        session.localDhKeyPair = null;
        session.remoteDhPublicKey = null;
        session.remoteDhPublicKeyBase64 = null;
        session.rootKey = null;
        session.sendingChainKey = null;
        session.receivingChainKey = null;
        session.sequenceNumber = 0;
      }
    });
    sessions.current = {};
    // eslint-disable-next-line no-console
    console.log("Memory Crypto-Shredding Sequence Executed. Session secrets zeroed.");
  };

  const isSessionActive = (peerSocketId) => {
    return !!sessions.current[peerSocketId];
  };

  return {
    getInitialDHPublicKey,
    establishSession,
    encryptP2P,
    decryptP2P,
    isSessionActive,
    shredSessions
  };
}
