import crypto from 'crypto';

/**
 * Token Encryption Utility
 *
 * Provides AES-256-GCM symmetric encryption for storing GitHub OAuth access
 * tokens at rest in the database. The ciphertext is opaque to the frontend
 * and is only decrypted server-side immediately before a GitHub API call.
 *
 * Key derivation:
 *   1. If GITHUB_TOKEN_ENCRYPTION_KEY is set in the environment, it is used
 *      directly (64-char hex string = 32 bytes, or any string hashed via SHA-256).
 *   2. Otherwise, 32 bytes are derived from JWT_SECRET via SHA-256 so that
 *      no extra operator configuration is needed for existing deployments.
 *
 * Wire format (colon-separated URL-safe base64 segments):
 *   iv:authTag:ciphertext
 *
 * Security notes:
 *   - A fresh 12-byte random IV is generated per encryption call.
 *   - GCM authentication tag detects any tampering of the stored ciphertext.
 *   - Tokens are NEVER logged or returned to the frontend.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // bytes — recommended for GCM
const TAG_LENGTH = 16; // bytes

/**
 * Derive the 32-byte encryption key from environment configuration.
 * @returns {Buffer} 32-byte key
 */
const deriveKey = () => {
  const explicit = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (explicit) {
    // Accept 64-char hex string (encodes exactly 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
      return Buffer.from(explicit, 'hex');
    }
    // Raw passphrase: hash to produce exactly 32 bytes
    return crypto.createHash('sha256').update(explicit).digest();
  }

  // Fallback: derive from JWT_SECRET (already required by the app)
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error(
      'Neither GITHUB_TOKEN_ENCRYPTION_KEY nor JWT_SECRET is configured. ' +
        'At least JWT_SECRET must be set to enable token encryption.'
    );
  }
  return crypto.createHash('sha256').update(jwtSecret).digest();
};

/**
 * Encrypt a plaintext access token.
 *
 * @param {string} plaintext - Raw GitHub OAuth access token
 * @returns {string} Encrypted blob: "iv:tag:ciphertext" (base64url segments)
 */
export const encryptToken = (plaintext) => {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('encryptToken: plaintext must be a non-empty string.');
  }

  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64url'), authTag.toString('base64url'), encrypted.toString('base64url')].join(':');
};

/**
 * Decrypt a token blob produced by encryptToken.
 *
 * @param {string} blob - Encrypted blob from the database
 * @returns {string} Decrypted plaintext token
 * @throws {Error} If the blob is malformed or the authentication tag fails
 */
export const decryptToken = (blob) => {
  if (!blob || typeof blob !== 'string') {
    throw new Error('decryptToken: blob must be a non-empty string.');
  }

  const parts = blob.split(':');
  if (parts.length !== 3) {
    throw new Error('decryptToken: invalid encrypted blob format (expected iv:tag:ciphertext).');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const key = deriveKey();
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'decryptToken: authentication tag verification failed. The stored token may have been tampered with.'
    );
  }
};
