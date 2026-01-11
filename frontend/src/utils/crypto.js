// Using Web Crypto API directly - no need for crypto-browserify

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
 * Encrypt a message using AES-256-GCM
 * @param {string} message - The message to encrypt
 * @param {string} password - The user password
 * @returns {Promise<Object>} - Encrypted data with IV and auth tag
 */
export async function encryptMessage(message, password) {
  try {
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    
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
    return decoder.decode(decryptedData);
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
