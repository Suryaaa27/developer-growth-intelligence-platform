import 'dotenv/config';
import express from 'express';
import assert from 'assert';
import http from 'http';
import { loginLimiter, registerLimiter } from '../src/middleware/rateLimiter.js';

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Authentication Rate Limiting Test Suite');
  console.log('====================================================\n');

  // Create an isolated Express app using the actual rate limiters
  const testApp = express();
  testApp.use(express.json());

  // Test endpoints mimicking auth routes
  testApp.post('/api/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    return res.status(200).json({ success: true, message: 'Authenticated' });
  });

  testApp.post('/api/auth/register', registerLimiter, (req, res) => {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }
    return res.status(201).json({ success: true, message: 'Registered' });
  });

  const server = http.createServer(testApp);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Test Server] Listening on ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  };

  try {
    // ── 1. Requests Below the Limit ─────────────────────────────────
    console.log('[1/4] Testing Requests Below Limit & Standard Headers...');
    await test('Initial login request succeeds and includes standard RateLimit headers', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      // Verify standard draft-7 headers are present
      assert(
        res.headers.has('ratelimit') || res.headers.has('ratelimit-limit'),
        'Must include standard RateLimit header'
      );
      assert(
        res.headers.has('ratelimit-policy') || res.headers.has('ratelimit-remaining'),
        'Must include standard RateLimit policy or remaining header'
      );

      // Verify legacy headers are disabled
      assert.strictEqual(res.headers.has('x-ratelimit-limit'), false, 'Legacy X-RateLimit-Limit must be disabled');
      assert.strictEqual(res.headers.has('x-ratelimit-remaining'), false, 'Legacy X-RateLimit-Remaining must be disabled');
    });

    // ── 2. Independent Registration Limiter Below Limit ─────────────
    console.log('\n[2/4] Testing Independent Registration Limiter...');
    await test('Registration limiter maintains its own quota independently of login', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@example.com' }),
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
    });

    // ── 3. Login Requests Exceeding Limit ───────────────────────────
    console.log('\n[3/4] Testing Login Rate Limit Enforcement (Exceeding Limit)...');
    await test('Successive login requests exceed the limit and return HTTP 429', async () => {
      // Default login limit is 10. We already made 1 request. Make 9 more to consume quota.
      for (let i = 0; i < 9; i++) {
        await fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
        });
      }

      // 11th request: MUST trigger HTTP 429
      const blockedRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
      });

      assert.strictEqual(blockedRes.status, 429, 'Exceeded requests must return HTTP 429 Too Many Requests');
      const blockedData = await blockedRes.json();
      assert.strictEqual(blockedData.success, false);
      assert.strictEqual(
        blockedData.message,
        'Too many login attempts from this IP address. Please try again after 15 minutes.'
      );
    });

    // ── 4. Independent Registration Limiter Quota ───────────────────
    console.log('\n[4/4] Testing Registration Limit Exceeded & Quota Isolation...');
    await test('Registration endpoint has independent quota and blocks at limit with HTTP 429', async () => {
      // Default register limit is 5. We already made 1 request. Make 3 more to reach 4.
      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: `reg_${i}@example.com` }),
        });
        assert.strictEqual(res.status, 201, `Request ${i + 2} should succeed under quota`);
      }

      // 5th request succeeds
      const fifthRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reg_5@example.com' }),
      });
      assert.strictEqual(fifthRes.status, 201);

      // 6th request: MUST trigger HTTP 429
      const blockedRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reg_blocked@example.com' }),
      });

      assert.strictEqual(blockedRes.status, 429, 'Registration limit exceeded must return HTTP 429');
      const blockedData = await blockedRes.json();
      assert.strictEqual(blockedData.success, false);
      assert.strictEqual(
        blockedData.message,
        'Too many account creation attempts from this IP address. Please try again after 15 minutes.'
      );
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
