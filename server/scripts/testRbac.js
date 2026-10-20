import 'dotenv/config';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/db.js';

/**
 * Automated RBAC Verification Test Suite
 * Validates requirements:
 * 1. Users table roles restricted to USER and ADMIN
 * 2. Public registration ignores client-supplied 'role' and enforces 'USER'
 * 3. JWT and authMiddleware derive ID & role strictly from verified token + DB
 * 4. ADMIN-only authorization middleware restricts unauthorized users
 * 5. Inactive accounts are blocked on login and protected endpoints
 * 6. IDOR prevention: users cannot access other users' data by changing ID
 * 7. Admin provisioning creates ADMIN accounts securely with bcrypt
 * 8. Valid ADMIN has access to administrative endpoints and user management
 */

const TEST_PORT = 5055;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

// Test users
const timestamp = Date.now();
const testUser = {
  name: 'RBAC Regular User',
  email: `rbac.user.${timestamp}@example.com`,
  password: 'UserPass123!',
};

const otherUser = {
  name: 'Other Target User',
  email: `rbac.other.${timestamp}@example.com`,
  password: 'OtherPass123!',
};

const testAdmin = {
  name: 'RBAC Platform Admin',
  email: `rbac.admin.${timestamp}@example.com`,
  password: 'AdminPass123!',
};

let userToken = null;
let userId = null;
let otherUserId = null;
let adminToken = null;
let adminId = null;

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

const runTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Role-Based Access Control (RBAC) Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description, detail = '') => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      if (detail) console.error(`     ↳ Details: ${detail}`);
      failed++;
    }
  };

  try {
    // Start temporary test server
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, resolve);
    });

    // ── Test 1: Verify MySQL Users Table Schema ──────────────────
    console.log('\n[1/11] Checking MySQL users table schema constraints...');
    const [cols] = await pool.query('DESCRIBE users');
    const roleCol = cols.find((c) => c.Field === 'role');
    const isActiveCol = cols.find((c) => c.Field === 'is_active');

    assert(
      roleCol && roleCol.Type.includes("'USER','ADMIN'"),
      "Users table 'role' column is strictly ENUM('USER', 'ADMIN')",
      `Actual Type: ${roleCol?.Type}`
    );
    assert(
      roleCol && roleCol.Default === 'USER',
      "Users table default role is 'USER'",
      `Actual Default: ${roleCol?.Default}`
    );
    assert(
      isActiveCol && isActiveCol.Null === 'NO',
      "Users table 'is_active' column is NOT NULL with default active",
      `Actual: ${JSON.stringify(isActiveCol)}`
    );

    // ── Test 2: Public Registration Ignores Client Role Parameter ─
    console.log('\n[2/11] Verifying public registration enforces USER role...');
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...testUser,
        role: 'ADMIN', // Tampering attempt: Client attempts to claim ADMIN
      }),
    });

    assert(regRes.status === 201, 'Registration returns 201 Created', `Got ${regRes.status}`);
    assert(
      regRes.data?.data?.user?.role === 'USER',
      'Client response receives role USER despite submitting ADMIN',
      `Got role: ${regRes.data?.data?.user?.role}`
    );

    userId = regRes.data?.data?.user?.id;
    userToken = regRes.data?.data?.token;

    // Verify directly in MySQL that role is truly 'USER'
    const [dbUser] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    assert(
      dbUser[0]?.role === 'USER',
      'Database record confirms role is strictly USER',
      `DB Role: ${dbUser[0]?.role}`
    );

    // Create a second user to test IDOR protections
    const regOther = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(otherUser),
    });
    otherUserId = regOther.data?.data?.user?.id;

    // ── Test 3: Missing Token on Protected Endpoints ──────────────
    console.log('\n[3/11] Testing unauthenticated access (missing token)...');
    const missingRes = await request('/api/auth/me');
    assert(
      missingRes.status === 401,
      'Protected endpoint returns 401 Unauthorized when token is missing',
      `Got status: ${missingRes.status}`
    );

    // ── Test 4: Invalid / Tampered Token ──────────────────────────
    console.log('\n[4/11] Testing invalid/tampered token rejection...');
    const invalidRes = await request('/api/auth/me', {
      headers: { Authorization: 'Bearer bogus.invalid.token' },
    });
    assert(
      invalidRes.status === 401,
      'Protected endpoint returns 401 Unauthorized for malformed/tampered token',
      `Got status: ${invalidRes.status}`
    );

    // ── Test 5: Valid USER Access to Own Resources ────────────────
    console.log('\n[5/11] Testing valid USER access to own profile...');
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK for valid USER');
    assert(meRes.data?.data?.user?.id === userId, 'Response user ID matches token owner');

    const profileRes = await request(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(profileRes.status === 200, `GET /api/users/${userId} returns 200 OK for account owner`);

    // ── Test 6: Unauthorized Data Access Prevention (IDOR) ────────
    console.log("\n[6/11] Testing unauthorized data access prevention (accessing another user's ID)...");
    const idorRes = await request(`/api/users/${otherUserId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      idorRes.status === 403,
      `GET /api/users/${otherUserId} rejected with 403 Forbidden when USER accesses another user's ID`,
      `Got status: ${idorRes.status}`
    );

    // ── Test 7: Rejected USER Access to ADMIN Endpoints ───────────
    console.log('\n[7/11] Testing rejected USER access to ADMIN-only endpoints...');
    const adminUsersRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      adminUsersRes.status === 403,
      'GET /api/admin/users returns 403 Forbidden for USER role',
      `Got status: ${adminUsersRes.status}`
    );

    const adminStatsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      adminStatsRes.status === 403,
      'GET /api/admin/stats returns 403 Forbidden for USER role',
      `Got status: ${adminStatsRes.status}`
    );

    const adminStatusRes = await request(`/api/admin/users/${otherUserId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(
      adminStatusRes.status === 403,
      'PATCH /api/admin/users/:id/status returns 403 Forbidden for USER role',
      `Got status: ${adminStatusRes.status}`
    );

    // ── Test 8: Inactive / Deactivated Account Enforcement ─────────
    console.log('\n[8/11] Testing inactive account blocking on protected endpoints and login...');
    // Deactivate user in DB
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);

    const inactiveMeRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      inactiveMeRes.status === 403,
      'GET /api/auth/me returns 403 Forbidden when user is inactive in DB',
      `Got status: ${inactiveMeRes.status}`
    );

    const inactiveLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });
    assert(
      inactiveLoginRes.status === 403,
      'POST /api/auth/login returns 403 Forbidden for deactivated accounts',
      `Got status: ${inactiveLoginRes.status}`
    );

    // Reactivate user for subsequent tests
    await pool.query('UPDATE users SET is_active = TRUE WHERE id = ?', [userId]);

    // ── Test 9: Secure Admin Provisioning ─────────────────────────
    console.log('\n[9/11] Provisioning admin account via secure hash mechanism...');
    // Hash password with bcryptjs
    const bcrypt = (await import('bcryptjs')).default;
    const adminSalt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(testAdmin.password, adminSalt);

    const [adminInsert] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "ADMIN", TRUE)',
      [testAdmin.name, testAdmin.email, adminHash]
    );
    adminId = adminInsert.insertId;

    // Login as ADMIN
    const adminLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdmin.email,
        password: testAdmin.password,
      }),
    });

    assert(adminLoginRes.status === 200, 'Admin login succeeds with 200 OK');
    assert(
      adminLoginRes.data?.data?.user?.role === 'ADMIN',
      'Admin login returns role ADMIN',
      `Got role: ${adminLoginRes.data?.data?.user?.role}`
    );
    adminToken = adminLoginRes.data?.data?.token;

    // ── Test 10: Valid ADMIN Access to Administrative Endpoints ───
    console.log('\n[10/11] Testing valid ADMIN access to admin endpoints...');
    const adminGetUsers = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminGetUsers.status === 200 && Array.isArray(adminGetUsers.data?.data?.users),
      'GET /api/admin/users returns 200 OK and user roster for ADMIN',
      `Got status: ${adminGetUsers.status}, users: ${adminGetUsers.data?.data?.users?.length}`
    );

    const adminGetStats = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminGetStats.status === 200 && adminGetStats.data?.data?.totalUsers !== undefined,
      'GET /api/admin/stats returns 200 OK and system stats for ADMIN',
      `Stats: ${JSON.stringify(adminGetStats.data?.data)}`
    );

    // ── Test 11: Valid ADMIN Access to User Profiles & Management ─
    console.log('\n[11/11] Testing ADMIN access to other user profiles and status updates...');
    const adminViewUserRes = await request(`/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      adminViewUserRes.status === 200,
      `GET /api/users/${userId} returns 200 OK for ADMIN viewing another user`,
      `Got status: ${adminViewUserRes.status}`
    );

    const adminDeactivateRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(
      adminDeactivateRes.status === 200,
      'ADMIN can deactivate a user via PATCH /api/admin/users/:id/status',
      `Status: ${adminDeactivateRes.status}, Body: ${JSON.stringify(adminDeactivateRes.data)}`
    );

    // Cleanup test data
    console.log('\n🧹 Cleaning up test accounts from database...');
    await pool.query('DELETE FROM users WHERE email IN (?, ?, ?)', [
      testUser.email,
      otherUser.email,
      testAdmin.email,
    ]);
    console.log('Test accounts cleaned up.');

    console.log('\n====================================================');
    console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Test suite fatal error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
    try {
      await pool.end();
    } catch (_) {}
  }
};

runTests();
