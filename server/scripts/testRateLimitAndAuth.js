import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';
import { encryptToken, decryptToken } from '../src/utils/tokenEncryption.js';
import { fetchUserRepos } from '../src/services/githubService.js';

/**
 * Rate-Limit & Authenticated-Request Test Suite
 *
 * Verifies:
 * 1. Token encryption round-trip (encryptToken / decryptToken)
 * 2. fetchUserRepos sends Authorization header when a token is provided
 * 3. fetchUserRepos does NOT send Authorization header when no token is provided
 * 4. HTTP 429 response -> GITHUB_RATE_LIMITED error with correct status
 * 5. HTTP 403 + x-ratelimit-remaining=0 -> GITHUB_RATE_LIMITED
 * 6. HTTP 403 + retry-after header (secondary rate limit) -> GITHUB_SECONDARY_RATE_LIMITED
 * 7. retryAfter value is extracted from x-ratelimit-reset header
 * 8. retryAfter value is extracted from retry-after header (secondary)
 * 9. POST /api/github/sync returns 429 with retryAfter + retryGuidance in body
 * 10. POST /api/github/sync with token in DB makes authenticated call to GitHub
 * 11. POST /api/github/sync without token falls back to anonymous call
 * 12. Unlinked user cannot sync (GITHUB_NOT_LINKED)
 * 13. Ownership mismatch returns GITHUB_OWNERSHIP_MISMATCH
 */

const TEST_PORT = 5097;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const linkedUserData = {
  name: `Rate Limit Alice ${timestamp}`,
  email: `rl.alice.${timestamp}@example.com`,
  password: 'Password123!',
  githubUsername: 'alice-rl',
};
const unlinkedUserData = {
  name: `Rate Limit Charlie ${timestamp}`,
  email: `rl.charlie.${timestamp}@example.com`,
  password: 'Password123!',
};

let linkedUserId = null;
let linkedUserToken = null;
let unlinkedUserId = null;
let unlinkedUserToken = null;

// ─── Mock control ────────────────────────────────────────────────────────────
let capturedAuthHeader = null; // captures the Authorization header sent to GitHub API
let mockScenario = 'NORMAL';   // 'NORMAL' | 'RATE_LIMIT_429' | 'RATE_LIMIT_403_REMAINING_0' | 'SECONDARY_RATE_LIMIT' | 'RATE_LIMIT_WITH_RESET'

const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  if (urlStr.includes('api.github.com')) {
    // Capture Authorization header for the auth-header tests
    capturedAuthHeader = options?.headers?.Authorization || null;

    if (mockScenario === 'RATE_LIMIT_429') {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mockScenario === 'RATE_LIMIT_403_REMAINING_0') {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        },
      });
    }

    if (mockScenario === 'SECONDARY_RATE_LIMIT') {
      return new Response(JSON.stringify({ message: 'You have exceeded a secondary rate limit' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'retry-after': '60',
        },
      });
    }

    if (mockScenario === 'RATE_LIMIT_WITH_RESET') {
      // 429 with x-ratelimit-reset header (epoch 900 seconds from now)
      const resetEpoch = Math.floor(Date.now() / 1000) + 900;
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-reset': String(resetEpoch),
        },
      });
    }

    // NORMAL: return one mock repo
    return new Response(
      JSON.stringify([
        {
          id: 42001,
          name: 'alice-rl-repo',
          full_name: 'alice-rl/alice-rl-repo',
          description: 'Test repo',
          language: 'JavaScript',
          html_url: 'https://github.com/alice-rl/alice-rl-repo',
          private: false,
          fork: false,
          stargazers_count: 1,
          forks_count: 0,
          default_branch: 'main',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Pass through to real local server
  return originalFetch(url, options);
};

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const { headers, ...rest } = options;
  const response = await originalFetch(url, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

// ─── Test runner ──────────────────────────────────────────────────────────────
const runTests = async () => {
  console.log('====================================================');
  console.log('🧪 Rate-Limit & Authenticated-Request Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  };

  try {
    // ──────────────────────────────────────────────────────────────
    // 0. Setup
    // ──────────────────────────────────────────────────────────────
    console.log('[Setup] Starting test server and creating test accounts...');
    server = app.listen(TEST_PORT);

    const hashed = await bcrypt.hash(linkedUserData.password, 10);

    // Create linked user with an encrypted token in the DB
    const encToken = encryptToken('gho_mock_token_for_alice_rl');
    const [resA] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username, github_access_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [linkedUserData.name, linkedUserData.email, hashed, 'USER', 1, 990001, linkedUserData.githubUsername, encToken]
    );
    linkedUserId = resA.insertId;

    // Create unlinked user (no github_id / github_username / github_access_token)
    const [resC] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [unlinkedUserData.name, unlinkedUserData.email, hashed, 'USER', 1]
    );
    unlinkedUserId = resC.insertId;

    const loginA = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: linkedUserData.email, password: linkedUserData.password }),
    });
    linkedUserToken = loginA.data?.data?.token;

    const loginC = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: unlinkedUserData.email, password: unlinkedUserData.password }),
    });
    unlinkedUserToken = loginC.data?.data?.token;

    console.log(`Setup complete. Linked user ID: ${linkedUserId}, Unlinked user ID: ${unlinkedUserId}\n`);

    // ──────────────────────────────────────────────────────────────
    // 1. Token encryption round-trip
    // ──────────────────────────────────────────────────────────────
    console.log('[1] Token encryption round-trip...');

    const plaintext = 'gho_test_token_abc123';
    const blob = encryptToken(plaintext);
    assert(typeof blob === 'string' && blob.split(':').length === 3, 'encryptToken returns iv:tag:ciphertext format');
    assert(blob !== plaintext, 'Encrypted blob differs from plaintext');

    const decrypted = decryptToken(blob);
    assert(decrypted === plaintext, 'decryptToken recovers original plaintext');

    // Different call -> different IV -> different ciphertext
    const blob2 = encryptToken(plaintext);
    assert(blob !== blob2, 'encryptToken produces unique ciphertext per call (fresh IV)');
    assert(decryptToken(blob2) === plaintext, 'Second encrypted blob also decrypts correctly');

    // Tampered blob is rejected
    const parts = blob.split(':');
    const tampered = [parts[0], parts[1], 'AAAAAAAAAA'].join(':');
    let decryptFailed = false;
    try { decryptToken(tampered); } catch { decryptFailed = true; }
    assert(decryptFailed, 'decryptToken rejects tampered ciphertext (GCM auth tag fails)');

    // ──────────────────────────────────────────────────────────────
    // 2. fetchUserRepos sends Authorization header when token provided
    // ──────────────────────────────────────────────────────────────
    console.log('\n[2] Authorization header presence in fetchUserRepos...');

    mockScenario = 'NORMAL';
    capturedAuthHeader = null;
    await fetchUserRepos('alice-rl', { accessToken: 'gho_mock_token', fetcher: globalThis.fetch });
    assert(
      capturedAuthHeader === 'Bearer gho_mock_token',
      'fetchUserRepos sends Authorization: Bearer <token> when token is provided'
    );

    capturedAuthHeader = null;
    await fetchUserRepos('alice-rl', { fetcher: globalThis.fetch });
    assert(capturedAuthHeader === null, 'fetchUserRepos omits Authorization header when no token is provided');

    // ──────────────────────────────────────────────────────────────
    // 3. HTTP 429 -> GITHUB_RATE_LIMITED
    // ──────────────────────────────────────────────────────────────
    console.log('\n[3] HTTP 429 primary rate limit handling...');

    mockScenario = 'RATE_LIMIT_429';
    let rateErr429 = null;
    try { await fetchUserRepos('alice-rl', { fetcher: globalThis.fetch }); } catch (e) { rateErr429 = e; }
    assert(rateErr429 !== null, 'fetchUserRepos throws on HTTP 429');
    assert(rateErr429.status === 429, 'Error has status 429');
    assert(rateErr429.code === 'GITHUB_RATE_LIMITED', 'Error code is GITHUB_RATE_LIMITED');

    // ──────────────────────────────────────────────────────────────
    // 4. HTTP 403 + x-ratelimit-remaining=0 -> GITHUB_RATE_LIMITED with retryAfter
    // ──────────────────────────────────────────────────────────────
    console.log('\n[4] HTTP 403 + x-ratelimit-remaining=0 rate limit with retryAfter...');

    mockScenario = 'RATE_LIMIT_403_REMAINING_0';
    let rateErr403 = null;
    try { await fetchUserRepos('alice-rl', { fetcher: globalThis.fetch }); } catch (e) { rateErr403 = e; }
    assert(rateErr403 !== null, 'fetchUserRepos throws on HTTP 403 with remaining=0');
    assert(rateErr403.status === 429, 'Error has status 429 (normalised from 403+remaining=0)');
    assert(rateErr403.code === 'GITHUB_RATE_LIMITED', 'Error code is GITHUB_RATE_LIMITED');
    assert(typeof rateErr403.retryAfter === 'number', 'retryAfter is a number');
    assert(rateErr403.retryAfter > 0, 'retryAfter is positive (future reset epoch)');

    // ──────────────────────────────────────────────────────────────
    // 5. Secondary rate limit (HTTP 403 + retry-after header)
    // ──────────────────────────────────────────────────────────────
    console.log('\n[5] Secondary rate limit (HTTP 403 + retry-after header)...');

    mockScenario = 'SECONDARY_RATE_LIMIT';
    let secondaryErr = null;
    try { await fetchUserRepos('alice-rl', { fetcher: globalThis.fetch }); } catch (e) { secondaryErr = e; }
    assert(secondaryErr !== null, 'fetchUserRepos throws on secondary rate limit');
    assert(secondaryErr.status === 429, 'Secondary rate limit error has status 429');
    assert(secondaryErr.code === 'GITHUB_SECONDARY_RATE_LIMITED', 'Error code is GITHUB_SECONDARY_RATE_LIMITED');
    assert(secondaryErr.retryAfter === 60, 'retryAfter is 60 (from retry-after: 60 header)');

    // ──────────────────────────────────────────────────────────────
    // 6. retryAfter extracted from x-ratelimit-reset on 429
    // ──────────────────────────────────────────────────────────────
    console.log('\n[6] retryAfter extracted from x-ratelimit-reset on HTTP 429...');

    mockScenario = 'RATE_LIMIT_WITH_RESET';
    let resetErr = null;
    try { await fetchUserRepos('alice-rl', { fetcher: globalThis.fetch }); } catch (e) { resetErr = e; }
    assert(resetErr !== null, 'fetchUserRepos throws on 429 with x-ratelimit-reset');
    assert(typeof resetErr.retryAfter === 'number', 'retryAfter is a number from x-ratelimit-reset');
    assert(resetErr.retryAfter >= 895 && resetErr.retryAfter <= 905, 'retryAfter is approximately 900 seconds');

    // ──────────────────────────────────────────────────────────────
    // 7. POST /api/github/sync returns 429 with retryAfter + retryGuidance
    // ──────────────────────────────────────────────────────────────
    console.log('\n[7] POST /api/github/sync returns retryAfter + retryGuidance on rate limit...');

    mockScenario = 'RATE_LIMIT_403_REMAINING_0';
    const syncRateLimit = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${linkedUserToken}` },
      body: JSON.stringify({ githubUsername: linkedUserData.githubUsername }),
    });
    assert(syncRateLimit.status === 429, 'POST /api/github/sync returns 429 when rate limited');
    assert(
      syncRateLimit.data?.code === 'GITHUB_RATE_LIMITED',
      'Response body contains code GITHUB_RATE_LIMITED'
    );
    assert(
      typeof syncRateLimit.data?.retryAfter === 'number',
      'Response body contains numeric retryAfter'
    );
    assert(
      typeof syncRateLimit.data?.retryGuidance === 'string' && syncRateLimit.data.retryGuidance.length > 0,
      'Response body contains retryGuidance string'
    );

    // ──────────────────────────────────────────────────────────────
    // 8. POST /api/github/sync secondary rate limit
    // ──────────────────────────────────────────────────────────────
    console.log('\n[8] POST /api/github/sync returns 429 with GITHUB_SECONDARY_RATE_LIMITED...');

    mockScenario = 'SECONDARY_RATE_LIMIT';
    const syncSecondary = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${linkedUserToken}` },
      body: JSON.stringify({ githubUsername: linkedUserData.githubUsername }),
    });
    assert(syncSecondary.status === 429, 'POST /api/github/sync returns 429 on secondary rate limit');
    assert(
      syncSecondary.data?.code === 'GITHUB_SECONDARY_RATE_LIMITED',
      'Response body contains code GITHUB_SECONDARY_RATE_LIMITED'
    );
    assert(syncSecondary.data?.retryAfter === 60, 'retryAfter is 60 for secondary rate limit');

    // ──────────────────────────────────────────────────────────────
    // 9. POST /api/github/sync uses the stored encrypted token
    //    (Authorization header is sent when token is in DB)
    // ──────────────────────────────────────────────────────────────
    console.log('\n[9] POST /api/github/sync sends authenticated request when token is stored...');

    mockScenario = 'NORMAL';
    capturedAuthHeader = null;
    const syncAuth = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${linkedUserToken}` },
      body: JSON.stringify({ githubUsername: linkedUserData.githubUsername }),
    });
    assert(syncAuth.status === 200, 'Sync with stored token returns 200');
    assert(
      capturedAuthHeader === 'Bearer gho_mock_token_for_alice_rl',
      'Sync call to GitHub includes the decrypted OAuth token as Authorization header'
    );

    // ──────────────────────────────────────────────────────────────
    // 10. POST /api/github/sync without token falls back to anonymous
    // ──────────────────────────────────────────────────────────────
    console.log('\n[10] POST /api/github/sync falls back to anonymous when no token is stored...');

    // Update DB to remove the token
    await pool.query('UPDATE users SET github_access_token = NULL WHERE id = ?', [linkedUserId]);

    mockScenario = 'NORMAL';
    capturedAuthHeader = 'sentinel'; // set to non-null so we can detect it being cleared
    const syncNoToken = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${linkedUserToken}` },
      body: JSON.stringify({ githubUsername: linkedUserData.githubUsername }),
    });
    assert(syncNoToken.status === 200, 'Sync without stored token still returns 200 (anonymous fallback)');
    assert(capturedAuthHeader === null, 'Anonymous fallback: no Authorization header sent to GitHub');

    // Restore token for remaining tests
    const encToken2 = encryptToken('gho_mock_token_for_alice_rl');
    await pool.query('UPDATE users SET github_access_token = ? WHERE id = ?', [encToken2, linkedUserId]);

    // ──────────────────────────────────────────────────────────────
    // 11. Unlinked user is rejected with GITHUB_NOT_LINKED
    // ──────────────────────────────────────────────────────────────
    console.log('\n[11] Unlinked user cannot sync (GITHUB_NOT_LINKED)...');

    const unlinkedSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${unlinkedUserToken}` },
      body: JSON.stringify({ githubUsername: 'charlie' }),
    });
    assert(unlinkedSync.status === 403, 'Unlinked user POST /api/github/sync returns 403');
    assert(unlinkedSync.data?.code === 'GITHUB_NOT_LINKED', 'Unlinked user receives GITHUB_NOT_LINKED code');

    // ──────────────────────────────────────────────────────────────
    // 12. Ownership mismatch returns GITHUB_OWNERSHIP_MISMATCH
    // ──────────────────────────────────────────────────────────────
    console.log('\n[12] Ownership mismatch returns GITHUB_OWNERSHIP_MISMATCH...');

    const mismatchSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${linkedUserToken}` },
      body: JSON.stringify({ githubUsername: 'not-alice-rl' }),
    });
    assert(mismatchSync.status === 403, 'Ownership mismatch returns 403');
    assert(mismatchSync.data?.code === 'GITHUB_OWNERSHIP_MISMATCH', 'Ownership mismatch returns GITHUB_OWNERSHIP_MISMATCH code');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    // ─── Cleanup ─────────────────────────────────────────────────
    console.log('\n🧹 Cleaning up rate-limit test accounts...');
    try {
      if (linkedUserId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [linkedUserId]);
        await pool.query('DELETE FROM users WHERE id = ?', [linkedUserId]);
      }
      if (unlinkedUserId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [unlinkedUserId]);
        await pool.query('DELETE FROM users WHERE id = ?', [unlinkedUserId]);
      }
      console.log('Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    globalThis.fetch = originalFetch;

    console.log('\n====================================================');
    console.log(`📊 Rate-Limit & Auth Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runTests();
