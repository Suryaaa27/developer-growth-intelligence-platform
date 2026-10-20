import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';

/**
 * Real GitHub API Smoke Test (Optional / Standalone)
 *
 * Hits public GitHub REST API for test user @octocat without any token
 * to verify live network connectivity, schema mapping, and end-to-end sync.
 */

const TEST_PORT = 5090;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const testUser = {
  name: 'Smoke Test User',
  email: `smoke.github.${timestamp}@example.com`,
  password: 'Password123!',
};

let userToken = null;
let userId = null;

const request = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const { headers, ...restOptions } = options;
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const runRealSmokeTest = async () => {
  console.log('====================================================');
  console.log('🌐 Starting Real GitHub Public API Smoke Test (@octocat)');
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
    console.log('[Setup] Starting test server and creating test account...');
    server = app.listen(TEST_PORT);

    const hashed = await bcrypt.hash(testUser.password, 10);
    const [res] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [testUser.name, testUser.email, hashed, 'USER', 1]
    );
    userId = res.insertId;

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    userToken = loginRes.data?.data?.token;

    console.log(`Setup complete. User ID: ${userId}\n`);

    console.log('[1/2] Calling POST /api/github/sync with real GitHub username "octocat"...');
    const syncRes = await request('/api/github/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ githubUsername: 'octocat' }),
    });

    assert(syncRes.status === 200, 'POST /api/github/sync returned 200 OK');
    assert(syncRes.data?.success === true, 'Response payload has success: true');
    assert(syncRes.data?.data?.syncedCount > 0, `Successfully synced ${syncRes.data?.data?.syncedCount} real repos for @octocat`);

    console.log('\n[2/2] Calling GET /api/github/repos to verify database persistence...');
    const getRes = await request('/api/github/repos', {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    assert(getRes.status === 200, 'GET /api/github/repos returned 200 OK');
    assert(getRes.data?.data?.count === syncRes.data?.data?.syncedCount, 'Returned repository count matches synced count');

    const sample = getRes.data?.data?.repositories?.[0];
    if (sample) {
      console.log(`  ℹ️ Sample Persisted Repo: "${sample.repoName}" (${sample.htmlUrl})`);
    }

  } catch (err) {
    console.error('Smoke test exception:', err);
    failed++;
  } finally {
    console.log('\n🧹 Cleaning up smoke test account and repositories from database...');
    try {
      if (userId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
      }
      console.log('Smoke test cleanup complete.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr.message);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n====================================================');
    console.log(`📊 Real GitHub Smoke Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    setTimeout(() => {
      process.exit(failed > 0 ? 1 : 0);
    }, 100);
  }
};

runRealSmokeTest();
