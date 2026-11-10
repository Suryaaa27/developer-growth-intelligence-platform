import crypto from 'crypto';

/**
 * Token Encryption Utility
 *
 * Provides AES-256-GCM symmetric encryption for storing GitHub OAuth access
 * tokens at rest in the database. The ciphertext is opaque to the frontend
 * and is only decrypted server-side immediately before a GitHub API call.
 *
 * Key hierarchy & Multi-Key Decryption Fallback:
 *   1. Primary Encryption Key:
 *      - GITHUB_TOKEN_ENCRYPTION_KEY if configured (64-char hex string = 32 bytes,
 *        or any string hashed via SHA-256).
 *      - Otherwise falls back to SHA-256(JWT_SECRET) for zero-config deployments.
 *   2. Decryption Candidate Sequence (in order of priority):
 *      - Priority 1: GITHUB_TOKEN_ENCRYPTION_KEY (primary key)
 *      - Priority 2: GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY (explicit 64-char hex migration key)
 *      - Priority 3: SHA-256(JWT_SECRET) (legacy derivation fallback)
 *      - Candidates are deduplicated by exact 32-byte equality.
 *
 * Wire format (colon-separated URL-safe base64 segments):
 *   iv:authTag:ciphertext
 *
 * Security notes:
 *   - Fresh 12-byte random IV generated per encryption call.
 *   - 16-byte GCM authentication tag guarantees ciphertext integrity and authenticity.
 *   - Plaintext tokens and keys are NEVER logged or exposed to the frontend.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes — standard recommended for GCM
const TAG_LENGTH = 16; // bytes — full 128-bit authentication tag

/**
 * Parse and validate the dedicated GITHUB_TOKEN_ENCRYPTION_KEY.
 *
 * Supported formats:
 *   - 64-character hexadecimal string representing exactly 32 raw bytes.
 *   - Raw passphrase string: hashed via SHA-256 to derive a 32-byte key.
 *
 * Safety & Error handling:
 *   - Rejects malformed values that appear intended to be 64-character hexadecimal keys
 *     (e.g., 64 chars with non-hex characters, or 60–68 hex characters) rather than silently
 *     hashing them as passphrases.
 *   - Rejects empty, whitespace-only, or non-string values.
 *
 * @param {string} explicit
 * @returns {Buffer} 32-byte Buffer key
 */
export const parseDedicatedKey = (explicit) => {
  if (!explicit || typeof explicit !== 'string') {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must be a non-empty string.');
  }

  const trimmed = explicit.trim();
  if (!trimmed) {
    throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must not be empty or whitespace.');
  }

  // Exact 64 hex characters: decode to 32 raw bytes
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // Malformed 64-character string containing non-hexadecimal characters
  if (trimmed.length === 64) {
    throw new Error(
      'Invalid GITHUB_TOKEN_ENCRYPTION_KEY: 64-character key contains invalid hexadecimal characters.'
    );
  }

  // Hexadecimal-like string of incorrect length (60 to 68 hex characters)
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 60 && trimmed.length <= 68) {
    throw new Error(
      `Invalid GITHUB_TOKEN_ENCRYPTION_KEY: Expected exactly 64 hexadecimal characters, but received ${trimmed.length}.`
    );
  }

  // Legitimate passphrase string: hash with SHA-256 to produce 32 bytes
  return crypto.createHash('sha256').update(trimmed).digest();
};

/**
 * Derive the primary 32-byte encryption key from environment configuration.
 *
 * Priority:
 *   1. GITHUB_TOKEN_ENCRYPTION_KEY (explicit primary key)
 *   2. JWT_SECRET (legacy fallback)
 *
 * @returns {Buffer} 32-byte Buffer key
 */
const getEncryptionKey = () => {
  const explicit = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    return parseDedicatedKey(explicit);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && typeof jwtSecret === 'string') {
    return crypto.createHash('sha256').update(jwtSecret).digest();
  }

  throw new Error(
    'Neither GITHUB_TOKEN_ENCRYPTION_KEY nor JWT_SECRET is configured. ' +
      'At least JWT_SECRET must be set to enable token encryption.'
  );
};

/**
 * Retrieve candidate keys for decryption in priority order.
 *
 * Priority:
 *   1. Dedicated GITHUB_TOKEN_ENCRYPTION_KEY (if configured)
 *   2. Dedicated GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY (if configured; must be 64-char hex)
 *   3. Legacy key derived from SHA-256(JWT_SECRET) (if configured)
 *
 * All candidate keys are deduplicated by exact 32-byte Buffer equality.
 *
 * @returns {Buffer[]} Array of 32-byte key Buffers to attempt
 */
const getDecryptionKeys = () => {
  const candidateKeys = [];

  const addCandidateKey = (key) => {
    if (!candidateKeys.some((existing) => existing.equals(key))) {
      candidateKeys.push(key);
    }
  };

  // 1. Primary key: GITHUB_TOKEN_ENCRYPTION_KEY
  const explicit = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (explicit && typeof explicit === 'string' && explicit.trim()) {
    const primaryKey = parseDedicatedKey(explicit);
    addCandidateKey(primaryKey);
  }

  // 2. Explicit legacy migration key: GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY (64-char hex)
  const legacyExplicit = process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  if (legacyExplicit !== undefined && legacyExplicit !== '') {
    if (typeof legacyExplicit !== 'string' || !/^[0-9a-fA-F]{64}$/.test(legacyExplicit.trim())) {
      throw new Error(
        'GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be a 64-character hexadecimal string representing a 32-byte key.'
      );
    }
    const legacyKey = Buffer.from(legacyExplicit.trim(), 'hex');
    addCandidateKey(legacyKey);
  }

  // 3. Fallback: SHA-256(JWT_SECRET)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && typeof jwtSecret === 'string') {
    const jwtKey = crypto.createHash('sha256').update(jwtSecret).digest();
    addCandidateKey(jwtKey);
  }

  return candidateKeys;
};

/**
 * Encrypt a plaintext access token using AES-256-GCM.
 *
 * Always uses the primary encryption key (GITHUB_TOKEN_ENCRYPTION_KEY or JWT_SECRET).
 *
 * @param {string} plaintext - Raw GitHub OAuth access token
 * @returns {string} Encrypted blob: "iv:tag:ciphertext" (base64url segments)
 */
export const encryptToken = (plaintext) => {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('encryptToken: plaintext must be a non-empty string.');
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
};

/**
 * Decrypt a token blob produced by encryptToken with multi-key fallback support.
 *
 * Validates the blob structure before attempting decryption.
 * Attempts candidate keys in order:
 *   1. Dedicated GITHUB_TOKEN_ENCRYPTION_KEY
 *   2. Explicit GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY
 *   3. Legacy SHA-256(JWT_SECRET)
 *
 * @param {string} blob - Encrypted blob from the database ("iv:tag:ciphertext")
 * @returns {string} Decrypted plaintext token
 * @throws {Error} If the blob is malformed or authentication tag verification fails for all keys
 */
export const decryptToken = (blob) => {
  if (!blob || typeof blob !== 'string') {
    throw new Error('decryptToken: blob must be a non-empty string.');
  }

  const parts = blob.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('decryptToken: invalid encrypted blob format (expected iv:tag:ciphertext).');
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
    throw new Error('decryptToken: invalid initialization vector or authentication tag length.');
  }

  const candidateKeys = getDecryptionKeys();
  if (candidateKeys.length === 0) {
    throw new Error(
      'Neither GITHUB_TOKEN_ENCRYPTION_KEY nor JWT_SECRET is configured. ' +
        'Cannot decrypt token without an encryption key.'
    );
  }

  for (const key of candidateKeys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      // Authentication tag mismatch or decipher error; continue to next candidate key
    }
  }

  throw new Error(
    'decryptToken: authentication tag verification failed. The stored token may have been tampered with or encrypted with an unknown key.'
  );
};

/**
 * Decrypt a token blob using ONLY the primary encryption key (no legacy fallback).
 *
 * Used for post-migration verification and detecting whether stored tokens are
 * already encrypted under the current primary key.
 *
 * @param {string} blob - Encrypted blob from the database ("iv:tag:ciphertext")
 * @returns {string} Decrypted plaintext token
 * @throws {Error} If the blob is malformed or not encrypted with the primary key
 */
export const decryptTokenWithPrimaryKeyOnly = (blob) => {
  if (!blob || typeof blob !== 'string') {
    throw new Error('decryptTokenWithPrimaryKeyOnly: blob must be a non-empty string.');
  }

  const parts = blob.split(':');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error(
      'decryptTokenWithPrimaryKeyOnly: invalid encrypted blob format (expected iv:tag:ciphertext).'
    );
  }

  const [ivB64, tagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(ciphertextB64, 'base64url');

  if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
    throw new Error(
      'decryptTokenWithPrimaryKeyOnly: invalid initialization vector or authentication tag length.'
    );
  }

  const explicit = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!explicit || typeof explicit !== 'string' || !explicit.trim()) {
    throw new Error(
      'decryptTokenWithPrimaryKeyOnly: GITHUB_TOKEN_ENCRYPTION_KEY is required and cannot fall back to JWT_SECRET.'
    );
  }

  const primaryKey = parseDedicatedKey(explicit);
  const decipher = crypto.createDecipheriv(ALGORITHM, primaryKey, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'decryptTokenWithPrimaryKeyOnly: authentication tag verification failed. Token is not encrypted with the primary key.'
    );
  }
};

/**
 * Check whether a token blob is already encrypted under the primary encryption key.
 *
 * @param {string} blob - Encrypted blob ("iv:tag:ciphertext")
 * @returns {boolean} True if successfully decrypted with the primary key alone
 * @throws {Error} If GITHUB_TOKEN_ENCRYPTION_KEY is missing or malformed
 */
export const isEncryptedWithPrimaryKey = (blob) => {
  try {
    decryptTokenWithPrimaryKeyOnly(blob);
    return true;
  } catch (err) {
    // Rethrow configuration errors so missing or malformed keys are not silently masked as false
    if (
      err.message &&
      (err.message.includes('GITHUB_TOKEN_ENCRYPTION_KEY') ||
        err.message.includes('cannot fall back to JWT_SECRET'))
    ) {
      throw err;
    }
    return false;
  }
};
