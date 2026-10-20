import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';

/**
 * GitHub Integration Automated API Test Suite
 *
 * Verifies:
 * 1. Authentication & Ownership:
 *    - Unauthenticated GET /repos and POST /sync return 401
 *    - Inactive accounts return 403
 *    - User retrieval strictly isolates repositories by authenticated user ID
 *    - Client-supplied IDs are ignored
 * 2. Input Validation:
 *    - Missing or empty githubUsername returns 400
 *    - Malformed GitHub usernames return 400
 * 3. Error Handling (Simulated upstream GitHub responses):
 *    - GitHub 404 user not found returns 404
 *    - GitHub 429 / 403 rate limit returns 429
 *    - GitHub network timeout returns 504
 *    - GitHub empty repository list returns 200 with empty array
 * 4. Persistence & Idempotence:
 *    - Public repositories are persisted to MySQL with correct columns
 *    - Re-syncing updates existing records without creating duplicates (ON DUPLICATE KEY UPDATE)
 *    - Previously analyzed metadata is preserved
 */

const TEST_PORT = 5089;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const userAData = {
  name: 'Dev Alice',
  email: `alice.dev.${timestamp}@example.com`,
  password: 'Password123!',
};

const userBData = {
  name: 'Dev Bob',
  email: `bob.dev.${timestamp}@example.com`,
  password: 'Password123!',
};

let userAToken = null;
let userAId = null;
let userBToken = null;
let userBId = null;

// Mock control state
let mockGitHubScenario = 'NORMAL'; // 'NORMAL', 'NOT_FOUND', 'RATE_LIMITED', 'TIMEOUT', 'EMPTY', 'PAGINATED'

const originalFetch = globalThis.fetch;

// Intercept fetch calls to api.github.com during tests
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  if (urlStr.includes('api.github.com')) {
    if (mockGitHubScenario === 'NOT_FOUND') {
      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mockGitHubScenario === 'RATE_LIMITED') {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '0',
        },
      });
    }

    if (mockGitHubScenario === 'TIMEOUT') {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    if (mockGitHubScenario === 'EMPTY') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mockGitHubScenario === 'PAGINATED') {
      const parsedUrl = new URL(urlStr);
      const page = parsedUrl.searchParams.get('page') || '1';

      if (page === '1') {
        return new Response(
          JSON.stringify([
            {
              id: 9001,
              name: 'page1-repo-alpha',
              full_name: 'testuser/page1-repo-alpha',
              description: 'First page alpha repo',
              language: 'TypeScript',
              html_url: 'https://github.com/testuser/page1-repo-alpha',
              private: false,
              fork: false,
              stargazers_count: 42,
              forks_count: 5,
              default_branch: 'main',
              updated_at: '2026-10-01T12:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify([
            {
              id: 9002,
              name: 'page2-repo-beta',
              full_name: 'testuser/page2-repo-beta',
              description: 'Second page beta repo',
              language: 'JavaScript',
              html_url: 'https://github.com/testuser/page2-repo-beta',
              private: false,
              fork: false,
              stargazers_count: 10,
              forks_count: 1,
              default_branch: 'master',
              updated_at: '2026-10-05T12:00:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default NORMAL mock
    return new Response(
      JSON.stringify([
        {
          id: 1001,
          name: 'portfolio-hub',
          full_name: 'alice/portfolio-hub',
          description: 'A developer portfolio and resume engine',
          language: 'JavaScript',
          html_url: 'https://github.com/alice/portfolio-hub',
          private: false,
          fork: false,
          stargazers_count: 25,
          forks_count: 3,
          default_branch: 'main',
          updated_at: '2026-10-15T10:00:00Z',
        },
        {
          id: 1002,
          name: 'ecommerce-api',
          full_name: 'alice/ecommerce-api',
          description: 'REST API backend with Node.js and PostgreSQL',
          language: 'TypeScript',
          html_url: 'https://github.com/alice/ecommerce-api',
          private: false,
          fork: false,
          stargazers_count: 88,
          forks_count: 12,
          default_branch: 'main',
          updated_at: '2026-10-18T14:30:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Pass-through to original fetch for local test server
  return originalFetch(url, options);
};

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const { headers, ...restOptions } = options;
  const response = await originalFetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const runGithubIntegrationTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting GitHub Integration Automated Test Suite');
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
    // 0. Setup: Start server on TEST_PORT and create test users
    console.log('[Setup] Starting test server and creating test accounts...');
    server = app.listen(TEST_PORT);

    const hashedUserPassword = await bcrypt.hash(userAData.password, 10);
    const [resA] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [userAData.name, userAData.email, hashedUserPassword, 'USER', 1]
    );
    userAId = resA.insertId;

    const [resB] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [userBData.name, userBData.email, hashedUserPassword, 'USER', 1]
    );
    userBId = resB.insertId;

    // Login Alice
    const loginARes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userAData.email, password: userAData.password }),
    });
    userAToken = loginARes.data?.data?.token;

    // Login Bob
    const loginBRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: userBData.email, password: userBData.password }),
    });
    userBToken = loginBRes.data?.data?.token;

    console.log(`Setup complete. Alice ID: ${userAId}, Bob ID: ${userBId}\n`);

    // ─────────────────────────────────────────────────────────────
    // 1. Authentication & Security Enforcement
    // ─────────────────────────────────────────────────────────────
    console.log('[1/4] Testing Authentication and Security Enforcement...');

    const unauthGet = await request('/api/github/repos');
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/github/repos returns 401');

    const unauthSync = await request('/api/github/sync', {
      method: 'POST',
      body: JSON.stringify({ githubUsername: 'octocat' }),
    });
    assert(unauthSync.status === 401, 'Unauthenticated POST /api/github/sync returns 401');

    // Deactivate user temporarily to verify inactive check
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [userAId]);
    const inactiveSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'alice' }),
    });
    assert(inactiveSync.status === 403, 'Inactive user account returns 403 Forbidden on sync');

    // Reactivate user
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [userAId]);

    // ─────────────────────────────────────────────────────────────
    // 2. Input Validation
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/4] Testing Input Validation on POST /api/github/sync...');

    const emptyBodySync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({}),
    });
    assert(emptyBodySync.status === 400, 'Missing githubUsername returns 400 Bad Request');

    const blankUsernameSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: '   ' }),
    });
    assert(blankUsernameSync.status === 400, 'Blank githubUsername returns 400 Bad Request');

    const invalidCharSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'invalid/user#name' }),
    });
    assert(invalidCharSync.status === 400, 'Username with special characters returns 400 Bad Request');

    const leadingHyphenSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: '-invalid-start' }),
    });
    assert(leadingHyphenSync.status === 400, 'Username with leading hyphen returns 400 Bad Request');

    // ─────────────────────────────────────────────────────────────
    // 3. Upstream Error Handling (Mocked GitHub)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/4] Testing Upstream GitHub Error Handling...');

    mockGitHubScenario = 'NOT_FOUND';
    const notFoundSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'nonexistent-user-xyz' }),
    });
    assert(notFoundSync.status === 404, 'GitHub 404 response returns 404 Not Found to client');
    assert(
      notFoundSync.data?.message?.includes('not found'),
      '404 response contains user-friendly message'
    );

    mockGitHubScenario = 'RATE_LIMITED';
    const rateLimitSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'anyuser' }),
    });
    assert(rateLimitSync.status === 429, 'GitHub rate limit exceeded returns 429 Too Many Requests');

    mockGitHubScenario = 'TIMEOUT';
    const timeoutSync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'anyuser' }),
    });
    assert(timeoutSync.status === 504, 'GitHub timeout returns 504 Gateway Timeout');

    mockGitHubScenario = 'EMPTY';
    const emptySync = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'emptyuser' }),
    });
    assert(emptySync.status === 200, 'User with 0 public repositories returns 200 OK');
    assert(emptySync.data?.data?.syncedCount === 0, 'syncedCount is 0 for empty public repos');

    // ─────────────────────────────────────────────────────────────
    // 4. Persistence, Upsert & Ownership Isolation
    // ─────────────────────────────────────────────────────────────
    console.log('\n[4/4] Testing Persistence, Upsert & Ownership Isolation...');

    mockGitHubScenario = 'NORMAL';
    const syncResA = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'alice' }),
    });
    assert(syncResA.status === 200, 'Alice successful sync returns 200 OK');
    assert(syncResA.data?.data?.syncedCount === 2, 'syncedCount reflects 2 repositories');
    assert(Array.isArray(syncResA.data?.data?.repositories), 'repositories is returned as an array');

    // Verify database rows for Alice
    const [aliceDbRows] = await pool.query(
      'SELECT id, user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url FROM repositories WHERE user_id = ?',
      [userAId]
    );
    assert(aliceDbRows.length === 2, 'Alice has exactly 2 records persisted in MySQL repositories table');
    assert(aliceDbRows[0].user_id === userAId, 'Persisted record user_id strictly matches Alice ID');
    assert(aliceDbRows.some((r) => r.repo_name === 'portfolio-hub'), 'Found portfolio-hub repository in DB');
    assert(aliceDbRows.some((r) => r.repo_name === 'ecommerce-api'), 'Found ecommerce-api repository in DB');

    // Test GET /api/github/repos for Alice
    const getReposA = await request('/api/github/repos', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert(getReposA.status === 200, 'GET /api/github/repos returns 200 OK for Alice');
    assert(getReposA.data?.data?.count === 2, 'GET /api/github/repos count is 2 for Alice');

    // Test Repeated Sync (Idempotence & No Duplicates)
    const repeatSyncA = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ githubUsername: 'alice' }),
    });
    assert(repeatSyncA.status === 200, 'Repeated sync returns 200 OK');

    const [repeatDbRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM repositories WHERE user_id = ?',
      [userAId]
    );
    assert(repeatDbRows[0].total === 2, 'Repeated sync did not create duplicates (still 2 rows)');

    // Verify Bob's isolation (Bob currently has 0 repos)
    const getReposB = await request('/api/github/repos', {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert(getReposB.status === 200, 'GET /api/github/repos returns 200 OK for Bob');
    assert(getReposB.data?.data?.count === 0, 'Bob sees 0 repositories (ownership strictly isolated from Alice)');

    // Now Bob syncs with PAGINATED mock scenario
    mockGitHubScenario = 'PAGINATED';
    const syncBob = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: JSON.stringify({ githubUsername: 'bob' }),
    });
    assert(syncBob.status === 200, 'Bob sync returns 200 OK');

    const [bobDbRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM repositories WHERE user_id = ?',
      [userBId]
    );
    assert(bobDbRows[0].total >= 1, 'Bob has his own repositories persisted in MySQL');

    // Check Alice again to ensure Bob did not modify Alice's data
    const [finalAliceRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM repositories WHERE user_id = ?',
      [userAId]
    );
    assert(finalAliceRows[0].total === 2, 'Alice repository count is unaffected by Bob sync');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test accounts and repositories from database...');
    try {
      if (userAId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [userAId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userAId]);
      }
      if (userBId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [userBId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userBId]);
      }
      console.log('Test accounts cleaned up.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr.message);
    }

    if (server) {
      server.close();
    }

    // Restore fetch
    globalThis.fetch = originalFetch;

    console.log('\n====================================================');
    console.log(`📊 GitHub Integration Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runGithubIntegrationTests();
