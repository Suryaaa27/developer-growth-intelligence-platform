import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';

/**
 * Admin Backend Phase Automated API Test Suite
 *
 * Verifies:
 * 1. Overview Statistics: database records across users, repos, snapshots, roles, templates
 * 2. User Management: pagination, search, details, status toggling, self-disable protection
 * 3. Job-Role Management: full CRUD on target job roles and JSON required skills
 * 4. Recommendation Templates: full CRUD on reusable recommendation templates
 * 5. Security:
 *    - Unauthenticated requests receive 401
 *    - Regular USER requests receive 403
 *    - ADMIN requests receive 200 / 201
 *    - Never exposes password hashes
 */

const TEST_PORT = 5088;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const testUser = {
  name: 'Regular Developer',
  email: `regular.dev.${timestamp}@example.com`,
  password: 'UserSecret123!',
};

const testAdmin = {
  name: 'System Admin',
  email: `sys.admin.${timestamp}@example.com`,
  password: 'AdminSecret123!',
};

let userToken = null;
let userId = null;
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

const runAdminPhaseTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Admin Backend Phase Automated Test Suite');
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

    // ── Setup: Create USER and ADMIN accounts ────────────────────
    console.log('[Setup] Creating test USER and ADMIN accounts...');

    // Register USER via public endpoint
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser),
    });
    userId = regRes.data?.data?.user?.id;
    userToken = regRes.data?.data?.token;

    // Create ADMIN with bcrypt hash directly in MySQL
    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash(testAdmin.password, salt);
    const [adminInsert] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, "ADMIN", TRUE)',
      [testAdmin.name, testAdmin.email, adminHash]
    );
    adminId = adminInsert.insertId;

    // Login as ADMIN to get verified token
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: testAdmin.email,
        password: testAdmin.password,
      }),
    });
    adminToken = adminLogin.data?.data?.token;

    console.log(`Setup complete. User ID: ${userId}, Admin ID: ${adminId}\n`);

    // ====================================================================
    // 1. OVERVIEW STATISTICS ENDPOINT
    // ====================================================================
    console.log('[1/4] Testing Overview Statistics (GET /api/admin/stats)...');

    // Unauthenticated
    const unauthStats = await request('/api/admin/stats');
    assert(unauthStats.status === 401, 'Unauthenticated GET /api/admin/stats returns 401 Unauthorized');

    // USER role
    const userStatsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userStatsRes.status === 403, 'USER role GET /api/admin/stats returns 403 Forbidden');

    // ADMIN role
    const adminStatsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminStatsRes.status === 200, 'ADMIN role GET /api/admin/stats returns 200 OK');

    const statsData = adminStatsRes.data?.data;
    assert(typeof statsData?.totalUsers === 'number', 'Stats data contains totalUsers count', `Value: ${statsData?.totalUsers}`);
    assert(typeof statsData?.activeUsers === 'number', 'Stats data contains activeUsers count', `Value: ${statsData?.activeUsers}`);
    assert(typeof statsData?.repositoryCount === 'number', 'Stats data contains repositoryCount', `Value: ${statsData?.repositoryCount}`);
    assert(typeof statsData?.analysisCount === 'number', 'Stats data contains analysisCount', `Value: ${statsData?.analysisCount}`);
    assert(typeof statsData?.jobRolesCount === 'number', 'Stats data contains jobRolesCount', `Value: ${statsData?.jobRolesCount}`);
    assert(typeof statsData?.recommendationTemplatesCount === 'number', 'Stats data contains recommendationTemplatesCount', `Value: ${statsData?.recommendationTemplatesCount}`);

    // ====================================================================
    // 2. USER MANAGEMENT ENDPOINTS
    // ====================================================================
    console.log('\n[2/4] Testing User Management (/api/admin/users)...');

    // Unauthenticated
    const unauthUsers = await request('/api/admin/users');
    assert(unauthUsers.status === 401, 'Unauthenticated GET /api/admin/users returns 401 Unauthorized');

    // USER role
    const userUsersRes = await request('/api/admin/users', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userUsersRes.status === 403, 'USER role GET /api/admin/users returns 403 Forbidden');

    // ADMIN role paginated listing
    const adminUsersRes = await request('/api/admin/users?page=1&limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminUsersRes.status === 200, 'ADMIN GET /api/admin/users returns 200 OK');
    assert(Array.isArray(adminUsersRes.data?.data?.users), 'Returns array of user records');
    assert(adminUsersRes.data?.data?.pagination?.page === 1, 'Pagination reflects requested page 1');
    assert(adminUsersRes.data?.data?.pagination?.limit === 5, 'Pagination reflects limit 5');
    assert(adminUsersRes.data?.data?.pagination?.total >= 2, 'Pagination total count reflects actual records');

    // Security check: Verify password_hash is NEVER exposed in user listings
    const exposedPassword = adminUsersRes.data?.data?.users?.some((u) => u.password_hash || u.password);
    assert(!exposedPassword, 'User listing strictly does NOT expose password_hash or credentials');

    // Search functionality
    const searchRes = await request(`/api/admin/users?search=${encodeURIComponent(testUser.email)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(searchRes.status === 200, 'Search by email returns 200 OK');
    assert(
      searchRes.data?.data?.users?.some((u) => u.email === testUser.email),
      'Search correctly located the user by email filter'
    );

    // Get specific user details
    const userDetailsRes = await request(`/api/admin/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(userDetailsRes.status === 200, `ADMIN GET /api/admin/users/${userId} returns 200 OK with details`);
    assert(userDetailsRes.data?.data?.user?.email === testUser.email, 'User details match target ID');
    assert(typeof userDetailsRes.data?.data?.user?.repositoryCount === 'number', 'Details include repositoryCount');
    assert(typeof userDetailsRes.data?.data?.user?.analysisSnapshotCount === 'number', 'Details include analysisSnapshotCount');

    // Activate/Deactivate user status
    const deactivateRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(deactivateRes.status === 200, 'ADMIN successfully deactivated target user');
    assert(deactivateRes.data?.data?.isActive === false, 'Deactivation response confirms isActive = false');

    // Reactivate user
    const reactivateRes = await request(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: true }),
    });
    assert(reactivateRes.status === 200, 'ADMIN successfully reactivated target user');
    assert(reactivateRes.data?.data?.isActive === true, 'Reactivation response confirms isActive = true');

    // Security Rule: Admin cannot deactivate their own active session account
    const selfDeactivateRes = await request(`/api/admin/users/${adminId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ isActive: false }),
    });
    assert(
      selfDeactivateRes.status === 400,
      'ADMIN self-deactivation attempt rejected with 400 Bad Request',
      `Got status: ${selfDeactivateRes.status}, message: ${selfDeactivateRes.data?.message}`
    );

    // Security Rule: Admin cannot demote their own account to USER
    const selfDemoteRes = await request(`/api/admin/users/${adminId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: 'USER' }),
    });
    assert(
      selfDemoteRes.status === 400,
      'ADMIN self-demotion attempt rejected with 400 Bad Request',
      `Got status: ${selfDemoteRes.status}, message: ${selfDemoteRes.data?.message}`
    );

    // ====================================================================
    // 3. TARGET JOB-ROLE MANAGEMENT ENDPOINTS
    // ====================================================================
    console.log('\n[3/4] Testing Job-Role Management (/api/admin/roles)...');

    // Unauthenticated
    const unauthRoles = await request('/api/admin/roles');
    assert(unauthRoles.status === 401, 'Unauthenticated GET /api/admin/roles returns 401 Unauthorized');

    // USER role
    const userRolesRes = await request('/api/admin/roles', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userRolesRes.status === 403, 'USER role GET /api/admin/roles returns 403 Forbidden');

    // Create a new job role as ADMIN
    const rolePayload = {
      roleName: `Senior Fullstack Engineer ${timestamp}`,
      description: 'Designs and builds cloud-native backend and responsive UI services.',
      requiredSkills: [
        { name: 'JavaScript', category: 'Language', benchmarkScore: 85 },
        { name: 'React', category: 'Frontend', benchmarkScore: 80 },
        { name: 'Node.js', category: 'Backend', benchmarkScore: 85 },
        { name: 'MySQL', category: 'Database', benchmarkScore: 75 },
      ],
    };

    const createRoleRes = await request('/api/admin/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(rolePayload),
    });

    assert(createRoleRes.status === 201, 'ADMIN POST /api/admin/roles returns 201 Created');
    const createdRoleId = createRoleRes.data?.data?.role?.id;
    assert(Boolean(createdRoleId), 'Created role returned valid database ID');

    // List roles
    const listRolesRes = await request('/api/admin/roles', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listRolesRes.status === 200, 'ADMIN GET /api/admin/roles returns 200 OK');
    assert(
      listRolesRes.data?.data?.roles?.some((r) => r.id === createdRoleId),
      'Created job role appears in role listing'
    );

    // Get specific role by ID
    const getRoleRes = await request(`/api/admin/roles/${createdRoleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getRoleRes.status === 200, `ADMIN GET /api/admin/roles/${createdRoleId} returns 200 OK`);
    assert(Array.isArray(getRoleRes.data?.data?.role?.requiredSkills), 'Role requiredSkills returned as parsed JSON array');

    // Update job role
    const updateRoleRes = await request(`/api/admin/roles/${createdRoleId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        description: 'Updated comprehensive description for fullstack engineering role.',
        requiredSkills: [
          { name: 'TypeScript', category: 'Language', benchmarkScore: 90 },
          { name: 'Node.js', category: 'Backend', benchmarkScore: 90 },
        ],
      }),
    });
    assert(updateRoleRes.status === 200, `ADMIN PUT /api/admin/roles/${createdRoleId} returns 200 OK`);
    assert(
      updateRoleRes.data?.data?.role?.requiredSkills?.length === 2,
      'Updated skills JSON correctly stored and returned'
    );

    // Delete job role
    const deleteRoleRes = await request(`/api/admin/roles/${createdRoleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteRoleRes.status === 200, `ADMIN DELETE /api/admin/roles/${createdRoleId} returns 200 OK`);

    // Verify role no longer exists
    const getDeletedRole = await request(`/api/admin/roles/${createdRoleId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getDeletedRole.status === 404, 'Deleted job role returns 404 Not Found');

    // ====================================================================
    // 4. RECOMMENDATION TEMPLATES MANAGEMENT ENDPOINTS
    // ====================================================================
    console.log('\n[4/4] Testing Recommendation Templates (/api/admin/templates)...');

    // Unauthenticated
    const unauthTemplates = await request('/api/admin/templates');
    assert(unauthTemplates.status === 401, 'Unauthenticated GET /api/admin/templates returns 401 Unauthorized');

    // USER role
    const userTemplatesRes = await request('/api/admin/templates', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(userTemplatesRes.status === 403, 'USER role GET /api/admin/templates returns 403 Forbidden');

    // Create a recommendation template as ADMIN
    const templatePayload = {
      skillName: 'Docker',
      title: 'Containerize Node.js Microservices',
      description: 'Write robust Dockerfiles with multi-stage builds and non-root users.',
      resourceUrl: 'https://docs.docker.com/develop/develop-images/multistage-build/',
      priority: 'HIGH',
    };

    const createTemplateRes = await request('/api/admin/templates', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(templatePayload),
    });

    assert(createTemplateRes.status === 201, 'ADMIN POST /api/admin/templates returns 201 Created');
    const createdTemplateId = createTemplateRes.data?.data?.template?.id;
    assert(Boolean(createdTemplateId), 'Created template returned valid database ID');

    // List templates
    const listTemplatesRes = await request('/api/admin/templates', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(listTemplatesRes.status === 200, 'ADMIN GET /api/admin/templates returns 200 OK');
    assert(
      listTemplatesRes.data?.data?.templates?.some((t) => t.id === createdTemplateId),
      'Created template appears in templates listing'
    );

    // Filter templates by skillName
    const filterTemplatesRes = await request('/api/admin/templates?skillName=Docker', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(filterTemplatesRes.status === 200, 'Filter templates by skillName returns 200 OK');
    assert(
      filterTemplatesRes.data?.data?.templates?.every((t) => t.skillName === 'Docker'),
      'All filtered templates have skillName Docker'
    );

    // Get specific template by ID
    const getTemplateRes = await request(`/api/admin/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getTemplateRes.status === 200, `ADMIN GET /api/admin/templates/${createdTemplateId} returns 200 OK`);
    assert(getTemplateRes.data?.data?.template?.title === templatePayload.title, 'Template title matches');

    // Update template
    const updateTemplateRes = await request(`/api/admin/templates/${createdTemplateId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        title: 'Mastering Docker Multi-Stage Containerization',
        priority: 'CRITICAL',
      }),
    });
    assert(updateTemplateRes.status === 200, `ADMIN PUT /api/admin/templates/${createdTemplateId} returns 200 OK`);
    assert(
      updateTemplateRes.data?.data?.template?.priority === 'CRITICAL',
      'Updated template priority correctly reflected'
    );

    // Delete template
    const deleteTemplateRes = await request(`/api/admin/templates/${createdTemplateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(deleteTemplateRes.status === 200, `ADMIN DELETE /api/admin/templates/${createdTemplateId} returns 200 OK`);

    // Verify template no longer exists
    const getDeletedTemplate = await request(`/api/admin/templates/${createdTemplateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(getDeletedTemplate.status === 404, 'Deleted template returns 404 Not Found');

    // ── Cleanup Test Accounts ─────────────────────────────────────
    console.log('\n🧹 Cleaning up test accounts from database...');
    await pool.query('DELETE FROM users WHERE email IN (?, ?)', [
      testUser.email,
      testAdmin.email,
    ]);
    console.log('Test accounts cleaned up.');

    console.log('\n====================================================');
    console.log(`📊 Admin Phase Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Admin Phase Test suite fatal error:', err);
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

runAdminPhaseTests();
