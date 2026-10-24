import crypto from 'crypto';
import jwt from 'jsonwebtoken';

/**
 * OAuth State Store & Validator
 *
 * Cryptographically binds state to the initiating DevGrowth user ID,
 * provides short TTL (10 minutes), and enforces single-use (replay protection)
 * via an in-memory nonce revocation cache.
 *
 * Architectural Note / Limitation:
 * In a multi-node / horizontally scaled cluster without sticky sessions,
 * single-use state verification requires shared external infrastructure
 * (e.g. Redis or a database table). In this single-process Express architecture,
 * an in-memory Map with automated TTL eviction provides robust single-use protection
 * without requiring schema migrations.
 */

// In-memory Map: nonce -> { userId, expiresAt }
const activeStates = new Map();

// State validity duration: 10 minutes
const STATE_TTL_MS = 10 * 60 * 1000;

// Periodic cleanup of expired nonces (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of activeStates.entries()) {
    if (data.expiresAt <= now) {
      activeStates.delete(nonce);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Ensure the timer doesn't prevent Node.js process exit during tests
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Generate a cryptographically secure, user-bound, short-lived OAuth state token.
 *
 * @param {number|string} userId - Initiating DevGrowth user ID
 * @returns {string} Signed state token
 */
export const generateOAuthState = (userId) => {
  if (!userId) {
    throw new Error('User ID is required to generate OAuth state.');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }

  // 32-byte cryptographic random nonce
  const nonce = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const expiresAt = now + STATE_TTL_MS;

  // Track active nonce in memory for single-use replay protection
  activeStates.set(nonce, {
    userId: Number(userId),
    expiresAt,
  });

  // Create signed token encoding userId and nonce
  const payload = {
    userId: Number(userId),
    nonce,
    purpose: 'github_oauth_link',
  };

  return jwt.sign(payload, jwtSecret, { expiresIn: '10m' });
};

/**
 * Validate and consume an OAuth state token.
 * Single-use: The state nonce is immediately deleted upon first validation.
 *
 * @param {string} state - The state token received from GitHub callback
 * @returns {{ valid: boolean, userId?: number, reason?: string }}
 */
export const validateAndConsumeOAuthState = (state) => {
  if (!state || typeof state !== 'string') {
    return { valid: false, reason: 'missing_or_invalid_state_format' };
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return { valid: false, reason: 'server_jwt_secret_missing' };
  }

  let decoded;
  try {
    decoded = jwt.verify(state, jwtSecret);
  } catch (err) {
    return { valid: false, reason: 'state_signature_invalid_or_expired' };
  }

  if (decoded.purpose !== 'github_oauth_link' || !decoded.userId || !decoded.nonce) {
    return { valid: false, reason: 'state_payload_malformed' };
  }

  const nonce = decoded.nonce;
  const stored = activeStates.get(nonce);

  // If nonce not found in activeStates, it has either expired or already been consumed (replay attack)
  if (!stored) {
    return { valid: false, reason: 'state_already_used_or_expired' };
  }

  // Check TTL
  if (stored.expiresAt <= Date.now()) {
    activeStates.delete(nonce);
    return { valid: false, reason: 'state_expired' };
  }

  // Verify bound user ID
  if (stored.userId !== Number(decoded.userId)) {
    activeStates.delete(nonce);
    return { valid: false, reason: 'state_user_mismatch' };
  }

  // Consume nonce immediately (single-use guarantee)
  activeStates.delete(nonce);

  return {
    valid: true,
    userId: stored.userId,
  };
};

/**
 * Helper for tests: clear active states
 */
export const _testClearStates = () => activeStates.clear();

/**
 * Helper for tests: inspect active state count
 */
export const _testGetActiveStatesCount = () => activeStates.size;
