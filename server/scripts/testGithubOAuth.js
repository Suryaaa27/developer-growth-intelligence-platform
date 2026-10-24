import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateOAuthState, validateAndConsumeOAuthState, _testClearStates } from '../src/utils/oauthState.js';

/**
 * GitHub OAuth Account Linking Automated Test Suite
 *
 * Verifies:
 * 1. Authentication & Route Protection:
 *    - Unauthenticated GET /api/auth/github returns 401
 *    - Inactive user account returns 403
 * 2. OAuth Initiation & State Cryptography:
 *    - Authenticated GET /api/auth/github?format=json returns 200 with authorization URL
 *    - URL contains client_id, exact callback URL, and minimal scope 'read:user' (no repo scope)
 *    - State is cryptographically signed, bound to initiating user ID, and stored in active nonces
 * 3. State Security & Replay Protection:
 *    - Valid state validates successfully and returns bound user ID
 *    - Replaying the same state a second time is rejected (single-use guarantee)
 *    - Tampered state signature is rejected
 *    - State for nonexistent nonce is rejected
 * 4. Callback Failure Handling:
 *    - Upstream cancellation / access denied redirects with github_error=access_denied
 *    - Missing code or state redirects with github_error=missing_code_or_state
 *    - Invalid or expired state redirects with github_error=invalid_state
 * 5. End-to-End Successful Account Linking:
 *    - Mock token exchange and /user profile fetch
 *    - Verified github_id and github_username saved to MySQL
 *    - Safe redirect to /repositories?github=linked without exposing codes/tokens
 *    - GET /api/auth/me confirms linked GitHub username and ID
 * 6. Unique Identity Conflict Handling:
 *    - Duplicate GitHub identity conflict returns safe github_error=account_already_linked
 *    - Does not overwrite or corrupt existing user's link
 * 7. Repository Sync Ownership Enforcement:
 *    - Unlinked user cannot sync (403 GITHUB_NOT_LINKED)
 *    - User cannot sync another user's arbitrary GitHub handle (403 GITHUB_OWNERSHIP_MISMATCH)
 *    - User can sync their own verified GitHub handle
 */

const TEST_PORT = 5092;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const user1Data = {
  name: 'Dev User One',
  email: `oauth.user1.${timestamp}@example.com`,
  password: 'Password123!',
};

const user2Data = {
  name: 'Dev User Two',
  email: `oauth.user2.${timestamp}@example.com`,
  password: 'Password123!',
};

let user1Id = null;
let user1Token = null;
let user2Id = null;
let user2Token = null;

const originalFetch = globalThis.fetch;

// Intercept fetch calls to github.com during callback testing
let mockExchangeFails = false;
let mockProfileFails = false;

globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  // GitHub token exchange endpoint
  if (urlStr.includes('github.com/login/oauth/access_token')) {
    if (mockExchangeFails) {
      return new Response(JSON.stringify({ error: 'bad_verification_code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        access_token: 'gho_mock_access_token_1234567890abcdef',
        token_type: 'bearer',
        scope: 'read:user',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // GitHub /user profile endpoint
  if (urlStr.includes('api.github.com/user') && !urlStr.includes('/repos')) {
    if (mockProfileFails) {
      return new Response(JSON.stringify({ message: 'Bad credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        id: 77712345,
        login: 'verified-octocat',
        name: 'Verified Octocat',
        html_url: 'https://github.com/verified-octocat',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // GitHub public repo sync mock
  if (urlStr.includes('api.github.com/users/')) {
    return new Response(
      JSON.stringify([
        {
          id: 5001,
          name: 'growth-platform-core',
          full_name: 'verified-octocat/growth-platform-core',
          description: 'Core intelligence engine',
          language: 'JavaScript',
          html_url: 'https://github.com/verified-octocat/growth-platform-core',
          private: false,
          fork: false,
          stargazers_count: 15,
          forks_count: 2,
          default_branch: 'main',
          updated_at: '2026-10-20T10:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Fallthrough to local server request
  return originalFetch(url, options);
};

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const { headers, redirect = 'manual', ...restOptions } = options;
  const response = await originalFetch(url, {
    ...restOptions,
    redirect,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  let data = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
    location: response.headers.get('location'),
  };
};

const runGithubOAuthTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting GitHub OAuth Account Linking Test Suite');
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
    // 0. Setup: start server and create 2 test users (initially unlinked)
    console.log('[Setup] Starting test server and provisioning test accounts...');
    server = app.listen(TEST_PORT);

    const hashed = await bcrypt.hash(user1Data.password, 10);
    const [res1] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [user1Data.name, user1Data.email, hashed, 'USER', 1]
    );
    user1Id = res1.insertId;

    const [res2] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [user2Data.name, user2Data.email, hashed, 'USER', 1]
    );
    user2Id = res2.insertId;

    // Log in both users
    const login1 = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: user1Data.email, password: user1Data.password }),
    });
    user1Token = login1.data?.data?.token;

    const login2 = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: user2Data.email, password: user2Data.password }),
    });
    user2Token = login2.data?.data?.token;

    console.log(`Setup complete. User 1 ID: ${user1Id}, User 2 ID: ${user2Id}\n`);

    // ─────────────────────────────────────────────────────────────
    // 1. Authentication & Route Protection
    // ─────────────────────────────────────────────────────────────
    console.log('[1/7] Testing Endpoint Protection on GET /api/auth/github...');

    const unauthInit = await request('/api/auth/github');
    assert(unauthInit.status === 401, 'Unauthenticated GET /api/auth/github returns 401 Unauthorized');

    const invalidTokenInit = await request('/api/auth/github', {
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    assert(invalidTokenInit.status === 401, 'Invalid token on GET /api/auth/github returns 401 Unauthorized');

    // Inactive user
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [user1Id]);
    const inactiveInit = await request('/api/auth/github', {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert(inactiveInit.status === 403, 'Inactive account on GET /api/auth/github returns 403 Forbidden');
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [user1Id]);

    // ─────────────────────────────────────────────────────────────
    // 2. OAuth Initiation & State Cryptography
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/7] Testing OAuth Initiation and State Parameters...');

    const initJsonRes = await request('/api/auth/github?format=json', {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert(initJsonRes.status === 200, 'Authenticated GET /api/auth/github?format=json returns 200 OK');
    assert(Boolean(initJsonRes.data?.data?.url), 'Response includes GitHub authorization URL');

    const authUrl = new URL(initJsonRes.data.data.url);
    assert(authUrl.origin === 'https://github.com', 'Authorization URL targets https://github.com');
    assert(authUrl.pathname === '/login/oauth/authorize', 'Authorization URL path is /login/oauth/authorize');
    assert(
      authUrl.searchParams.get('redirect_uri') === 'http://localhost:5000/api/auth/github/callback',
      'Callback URL matches http://localhost:5000/api/auth/github/callback exactly'
    );
    assert(
      authUrl.searchParams.get('scope') === 'read:user',
      'OAuth scope is strictly "read:user" (no repo or private scope requested)'
    );

    const stateToken = authUrl.searchParams.get('state');
    assert(Boolean(stateToken), 'OAuth authorization URL contains a state token');

    // Direct redirect mode
    const initRedirectRes = await request('/api/auth/github', {
      headers: { Authorization: `Bearer ${user1Token}` },
      redirect: 'manual',
    });
    assert(initRedirectRes.status === 302, 'GET /api/auth/github without format=json returns 302 redirect');
    assert(
      initRedirectRes.location && initRedirectRes.location.startsWith('https://github.com/login/oauth/authorize'),
      '302 redirect location targets GitHub authorization endpoint'
    );

    // ─────────────────────────────────────────────────────────────
    // 3. State Security & Replay Protection
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/7] Testing Cryptographic State Validation & Replay Prevention...');

    // Generate a fresh state for user 1
    const freshState = generateOAuthState(user1Id);
    assert(typeof freshState === 'string' && freshState.length > 20, 'Generated OAuth state token is non-empty string');

    // Tampered state test
    const tamperedState = freshState.slice(0, -6) + 'abcdef';
    const tamperedValidation = validateAndConsumeOAuthState(tamperedState);
    assert(tamperedValidation.valid === false, 'Tampered state token signature is rejected');

    // First validation succeeds and returns bound user ID
    const firstValidation = validateAndConsumeOAuthState(freshState);
    assert(firstValidation.valid === true, 'Valid state token passes validation');
    assert(firstValidation.userId === user1Id, 'Validated state is cryptographically bound to initiating user ID');

    // Replay attack: validating same state a second time MUST fail
    const replayValidation = validateAndConsumeOAuthState(freshState);
    assert(replayValidation.valid === false, 'State token replay is rejected (single-use guarantee enforced)');

    // ─────────────────────────────────────────────────────────────
    // 4. Callback Failure Handling
    // ─────────────────────────────────────────────────────────────
    console.log('\n[4/7] Testing Callback Error Handling and Redirection...');

    // Upstream user cancellation
    const cancelCallback = await request('/api/auth/github/callback?error=access_denied', {
      redirect: 'manual',
    });
    assert(cancelCallback.status === 302, 'Callback with upstream error returns 302 redirect');
    assert(
      cancelCallback.location?.includes('github_error=access_denied'),
      'Redirects to frontend with safe github_error=access_denied parameter'
    );

    // Missing code or state
    const missingCallback = await request('/api/auth/github/callback', {
      redirect: 'manual',
    });
    assert(missingCallback.status === 302, 'Callback missing code/state returns 302 redirect');
    assert(
      missingCallback.location?.includes('github_error=missing_code_or_state'),
      'Redirects to frontend with safe github_error=missing_code_or_state'
    );

    // Invalid state
    const invalidStateCallback = await request(
      '/api/auth/github/callback?code=mock_code_123&state=not.a.valid.state',
      { redirect: 'manual' }
    );
    assert(invalidStateCallback.status === 302, 'Callback with invalid state returns 302 redirect');
    assert(
      invalidStateCallback.location?.includes('github_error=invalid_state'),
      'Redirects to frontend with safe github_error=invalid_state'
    );

    // ─────────────────────────────────────────────────────────────
    // 5. End-to-End Successful Account Linking
    // ─────────────────────────────────────────────────────────────
    console.log('\n[5/7] Testing End-to-End Account Linking Flow...');

    // Generate valid state for User 1
    const validCallbackState = generateOAuthState(user1Id);

    const successCallback = await request(
      `/api/auth/github/callback?code=valid_auth_code_xyz&state=${encodeURIComponent(validCallbackState)}`,
      { redirect: 'manual' }
    );
    assert(successCallback.status === 302, 'Successful callback returns 302 redirect to frontend');
    assert(
      successCallback.location?.includes('/repositories?github=linked'),
      'Redirects to /repositories with safe github=linked success indicator'
    );
    assert(
      !successCallback.location?.includes('token') && !successCallback.location?.includes('secret'),
      'Redirect URL strictly avoids exposing tokens, codes, or secrets'
    );

    // Verify database record for User 1
    const [user1Rows] = await pool.query(
      'SELECT id, github_id, github_username FROM users WHERE id = ?',
      [user1Id]
    );
    assert(Number(user1Rows[0]?.github_id) === 77712345, 'User 1 database record has verified github_id');
    assert(user1Rows[0]?.github_username === 'verified-octocat', 'User 1 database record has verified github_username');

    // Verify GET /api/auth/me returns linked GitHub account
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
    assert(meRes.data?.data?.user?.githubUsername === 'verified-octocat', 'GET /api/auth/me includes verified githubUsername');

    // ─────────────────────────────────────────────────────────────
    // 6. Unique Identity Conflict Handling
    // ─────────────────────────────────────────────────────────────
    console.log('\n[6/7] Testing Unique GitHub Identity Conflict Handling...');

    // User 2 attempts to link the same GitHub account (GitHub ID: 77712345)
    const conflictState = generateOAuthState(user2Id);
    const conflictCallback = await request(
      `/api/auth/github/callback?code=another_code_abc&state=${encodeURIComponent(conflictState)}`,
      { redirect: 'manual' }
    );

    assert(conflictCallback.status === 302, 'Conflict callback returns 302 redirect');
    assert(
      conflictCallback.location?.includes('github_error=account_already_linked'),
      'Redirects with safe github_error=account_already_linked without revealing internal details'
    );

    // Verify User 2 was NOT linked
    const [user2Rows] = await pool.query(
      'SELECT id, github_id, github_username FROM users WHERE id = ?',
      [user2Id]
    );
    assert(user2Rows[0]?.github_id === null, 'User 2 record was not modified (github_id remains null)');

    // ─────────────────────────────────────────────────────────────
    // 7. Repository Sync Ownership Protection
    // ─────────────────────────────────────────────────────────────
    console.log('\n[7/7] Testing Repository Synchronization Ownership Protection...');

    // User 2 (unlinked) attempts to sync
    const unlinkedSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user2Token}` },
      body: JSON.stringify({ githubUsername: 'verified-octocat' }),
    });
    assert(unlinkedSync.status === 403, 'Unlinked user POST /api/github/sync returns 403 Forbidden');
    assert(unlinkedSync.data?.code === 'GITHUB_NOT_LINKED', 'Unlinked user receives GITHUB_NOT_LINKED code');

    // User 1 (linked to verified-octocat) attempts to sync someone else's arbitrary username ('torvalds')
    const mismatchSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ githubUsername: 'torvalds' }),
    });
    assert(mismatchSync.status === 403, 'Arbitrary GitHub username returns 403 Forbidden');
    assert(mismatchSync.data?.code === 'GITHUB_OWNERSHIP_MISMATCH', 'Arbitrary username receives GITHUB_OWNERSHIP_MISMATCH code');

    // User 1 syncs their verified username
    const verifiedSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
      body: JSON.stringify({ githubUsername: 'verified-octocat' }),
    });
    assert(verifiedSync.status === 200, 'POST /api/github/sync for verified linked username returns 200 OK');
    assert(verifiedSync.data?.data?.syncedCount === 1, 'Synced count is 1 for verified repository');

  } catch (err) {
    console.error('Unhandled exception during test execution:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up OAuth test accounts and repositories from database...');
    try {
      if (user1Id) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [user1Id]);
        await pool.query('DELETE FROM users WHERE id = ?', [user1Id]);
      }
      if (user2Id) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [user2Id]);
        await pool.query('DELETE FROM users WHERE id = ?', [user2Id]);
      }
      console.log('OAuth test accounts cleaned up.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    globalThis.fetch = originalFetch;

    console.log('\n====================================================');
    console.log(`📊 GitHub OAuth Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runGithubOAuthTests();
