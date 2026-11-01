import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
import app from '../src/app.js';
import {
  isSkillMatch,
  checkRequiredSkillSatisfied,
  evaluateRoleCoverage,
} from '../src/utils/skillMatcher.js';
import { runMigration as runExpandCatalog } from './migrations/004_expand_role_catalog.js';

const TEST_PORT = 5007;
const baseUrl = `http://localhost:${TEST_PORT}`;

const testUserData = {
  name: 'Role Tester',
  email: `role_tester_${Date.now()}@example.com`,
  password: 'Password123!',
  githubUsername: 'role-tester',
};

let server = null;
let userId = null;
let userToken = null;

const request = async (endpoint, options = {}) => {
  const url = `${baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
};

const runRoleCatalogTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Role Catalog & Skill Matcher Test Suite');
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
    // 0. Start test server and provision test user
    server = app.listen(TEST_PORT);
    const hashedPwd = await bcrypt.hash(testUserData.password, 10);
    const [userRes] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testUserData.name, testUserData.email, hashedPwd, 'USER', 1, 999888, testUserData.githubUsername]
    );
    userId = userRes.insertId;

    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUserData.email, password: testUserData.password }),
    });
    userToken = loginRes.data?.data?.token;

    // ─────────────────────────────────────────────────────────────
    // 1. Skill Matcher Unit Verification (False-Positive Protection)
    // ─────────────────────────────────────────────────────────────
    console.log('[1/5] Testing Skill Matcher Normalization & Guard Logic...');

    // Short-token false-positive protection:
    assert(!isSkillMatch('C', 'JavaScript'), "Required 'C' does NOT match 'JavaScript'");
    assert(!isSkillMatch('C', 'Docker'), "Required 'C' does NOT match 'Docker'");
    assert(!isSkillMatch('C', 'React'), "Required 'C' does NOT match 'React'");
    assert(!isSkillMatch('R', 'Docker'), "Required 'R' does NOT match 'Docker'");
    assert(!isSkillMatch('Go', 'MongoDB'), "Required 'Go' does NOT match 'MongoDB'");
    assert(!isSkillMatch('Go', 'Django'), "Required 'Go' does NOT match 'Django'");

    // Positive matches:
    assert(isSkillMatch('C', 'C'), "Required 'C' matches exact 'C'");
    assert(isSkillMatch('Go', 'Go'), "Required 'Go' matches exact 'Go'");
    assert(isSkillMatch('Go', 'Go Language'), "Required 'Go' matches 'Go Language'");
    assert(isSkillMatch('Jest', 'Jest (Testing)'), "Required 'Jest' matches 'Jest (Testing)'");
    assert(isSkillMatch('GitHub Actions', 'GitHub Actions (CI/CD)'), "Required 'GitHub Actions' matches 'GitHub Actions (CI/CD)'");
    assert(isSkillMatch('CI/CD', 'GitHub Actions (CI/CD)'), "Required 'CI/CD' matches 'GitHub Actions (CI/CD)'");
    assert(isSkillMatch('MongoDB', 'MongoDB (Mongoose)'), "Required 'MongoDB' matches 'MongoDB (Mongoose)'");
    assert(isSkillMatch('SQL', 'PostgreSQL'), "Required 'SQL' matches 'PostgreSQL'");
    assert(isSkillMatch('SQL', 'MySQL'), "Required 'SQL' matches 'MySQL'");
    assert(isSkillMatch('PyTorch / TensorFlow', 'PyTorch'), "Compound 'PyTorch / TensorFlow' matches 'PyTorch'");

    // Role coverage evaluation:
    const mockRoleRequirements = [
      { name: 'JavaScript', category: 'Language' },
      { name: 'React', category: 'Frontend' },
      { name: 'Docker', category: 'DevOps' },
      { name: 'C', category: 'Language' },
    ];
    const mockDetected = ['JavaScript', 'Docker Compose', 'HTML'];
    const evalResult = evaluateRoleCoverage(mockRoleRequirements, mockDetected);

    assert(evalResult.totalRequired === 4, 'totalRequired is 4');
    assert(evalResult.matchedCount === 2, 'matchedCount is 2 (JavaScript and Docker)');
    assert(evalResult.matchedSkills.includes('JavaScript'), 'matchedSkills includes JavaScript');
    assert(evalResult.matchedSkills.includes('Docker'), 'matchedSkills includes Docker (via Docker Compose)');
    assert(evalResult.missingSkills.includes('C'), "missingSkills includes 'C' without false-matching JavaScript/Docker");
    assert(evalResult.coverageScore === 50, 'coverageScore is exactly 50%');

    // ─────────────────────────────────────────────────────────────
    // 2. Database Catalog & Idempotency Verification
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/5] Testing Role Catalog Database State & Idempotency...');
    const [dbRolesBefore] = await pool.query('SELECT count(*) as count FROM role_requirements');
    assert(dbRolesBefore[0].count >= 30, `Database contains expanded role catalog (found ${dbRolesBefore[0].count} roles)`);

    // Re-run migration 004 to verify zero duplication and safety
    await runExpandCatalog();
    const [dbRolesAfter] = await pool.query('SELECT count(*) as count FROM role_requirements');
    assert(dbRolesAfter[0].count === dbRolesBefore[0].count, 'Re-running seed operation does not duplicate roles (count unchanged)');

    // ─────────────────────────────────────────────────────────────
    // 3. GET /api/roles Endpoint Security & Content
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/5] Testing GET /api/roles (Public Access for Registration & Authenticated Retrieval)...');
    const unauthRoles = await request('/api/roles');
    assert(unauthRoles.status === 200, 'Unauthenticated GET /api/roles returns 200 OK (accessible for registration page)');
    assert(Array.isArray(unauthRoles.data?.data?.roles), 'Public response contains roles array');
    assert(unauthRoles.data?.data?.roles?.length >= 30, `Public roles array has >= 30 roles (found ${unauthRoles.data?.data?.roles?.length})`);

    const authRoles = await request('/api/roles', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(authRoles.status === 200, 'Authenticated GET /api/roles returns 200 OK');
    assert(Array.isArray(authRoles.data?.data?.roles), 'Response contains roles array');
    assert(authRoles.data?.data?.roles?.length >= 30, `Roles array has >= 30 roles (found ${authRoles.data?.data?.roles?.length})`);

    // Verify categories are present on returned roles
    const hasCategories = authRoles.data?.data?.roles.every((r) => typeof r.category === 'string' && r.category.length > 0);
    assert(hasCategories, 'Every role has a populated category string');

    const roleNames = authRoles.data?.data?.roles.map((r) => r.roleName);
    assert(roleNames.includes('Java Backend Developer'), "Catalog includes 'Java Backend Developer'");
    assert(roleNames.includes('Frontend Developer'), "Catalog includes 'Frontend Developer'");
    assert(roleNames.includes('Go Developer'), "Catalog includes 'Go Developer'");
    assert(roleNames.includes('Android Developer'), "Catalog includes 'Android Developer'");
    assert(roleNames.includes('iOS Developer'), "Catalog includes 'iOS Developer'");
    assert(roleNames.includes('Machine Learning Engineer'), "Catalog includes 'Machine Learning Engineer'");
    assert(roleNames.includes('DevOps Engineer'), "Catalog includes 'DevOps Engineer'");
    assert(roleNames.includes('Security Engineer'), "Catalog includes 'Security Engineer'");
    assert(roleNames.includes('Test Automation Engineer'), "Catalog includes 'Test Automation Engineer'");
    assert(roleNames.includes('Embedded Software Engineer'), "Catalog includes 'Embedded Software Engineer'");
    assert(roleNames.includes('Software Architect'), "Catalog includes 'Software Architect'");

    // Verify all roles have non-empty requiredSkills array
    const allHaveSkills = authRoles.data?.data?.roles.every(
      (r) => Array.isArray(r.requiredSkills) && r.requiredSkills.length >= 4
    );
    assert(allHaveSkills, 'Every role has a non-empty, valid requiredSkills list (>= 4 skills)');

    // ─────────────────────────────────────────────────────────────
    // 3b. Registration, Login, and User Target Role Persistence
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3b/5] Testing Registration with Target Role & Target Role Profile Updates...');
    const regEmail = `reg_role_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Target Role User',
        email: regEmail,
        password: 'Password123!',
        targetRole: 'DevOps Engineer',
      }),
    });
    assert(regRes.status === 201, 'POST /api/auth/register with targetRole returns 201 Created');
    assert(regRes.data?.data?.user?.targetRole === 'DevOps Engineer', 'Registered user has targetRole = DevOps Engineer');
    assert(typeof regRes.data?.data?.user?.targetRoleId === 'number', 'Registered user has valid targetRoleId');
    const newUserId = regRes.data?.data?.user?.id;
    const newUserToken = regRes.data?.data?.token;

    // Login with new user
    const newLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: regEmail, password: 'Password123!' }),
    });
    assert(newLoginRes.status === 200, 'POST /api/auth/login returns 200 OK');
    assert(newLoginRes.data?.data?.user?.targetRole === 'DevOps Engineer', 'Login returns saved targetRole');
    assert(typeof newLoginRes.data?.data?.user?.targetRoleId === 'number', 'Login returns targetRoleId');

    // GET /api/auth/me
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${newUserToken}` },
    });
    assert(meRes.status === 200, 'GET /api/auth/me returns 200 OK');
    assert(meRes.data?.data?.user?.targetRole === 'DevOps Engineer', 'GET /api/auth/me returns targetRole');
    assert(typeof meRes.data?.data?.user?.targetRoleId === 'number', 'GET /api/auth/me returns targetRoleId');

    // Update target role via PATCH /api/users/:id/target-role
    const patchRes = await request(`/api/users/${newUserId}/target-role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${newUserToken}` },
      body: JSON.stringify({ targetRole: 'Machine Learning Engineer' }),
    });
    assert(patchRes.status === 200, 'PATCH /api/users/:id/target-role returns 200 OK');
    assert(patchRes.data?.data?.targetRole === 'Machine Learning Engineer', 'Target role successfully updated');

    // Inactive/invalid role rejected
    const invalidPatch = await request(`/api/users/${newUserId}/target-role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${newUserToken}` },
      body: JSON.stringify({ targetRole: 'NonExistent Role Name 12345' }),
    });
    assert(invalidPatch.status === 400, 'PATCH /api/users/:id/target-role with non-existent role returns 400');

    // Ownership protection: user cannot update another user's target role
    const forbiddenPatch = await request(`/api/users/${userId}/target-role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${newUserToken}` },
      body: JSON.stringify({ targetRole: 'Security Engineer' }),
    });
    assert(forbiddenPatch.status === 403, "Updating another user's target role returns 403 Forbidden");

    // Cleanup new test user
    await pool.query('DELETE FROM users WHERE id = ?', [newUserId]);

    // ─────────────────────────────────────────────────────────────
    // 4. GET /api/roles/:id & Search Query
    // ─────────────────────────────────────────────────────────────
    console.log('\n[4/5] Testing GET /api/roles/:id & ?search Query...');
    const firstRole = authRoles.data?.data?.roles[0];
    const singleRole = await request(`/api/roles/${firstRole.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(singleRole.status === 200, 'GET /api/roles/:id returns 200 OK');
    assert(singleRole.data?.data?.role?.roleName === firstRole.roleName, 'Single role matches requested ID');

    const searchRes = await request('/api/roles?search=Android', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(searchRes.status === 200, 'GET /api/roles?search=Android returns 200 OK');
    assert(searchRes.data?.data?.roles?.some((r) => r.roleName.includes('Android')), 'Search returns matching role');

    // ─────────────────────────────────────────────────────────────
    // 5. Analysis Snapshot Creation Across Catalog
    // ─────────────────────────────────────────────────────────────
    console.log('\n[5/5] Testing Analysis Snapshots With Expanded Catalog...');
    // Seed a repo for the test user to run analysis
    const [testRepo] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url, owner_login, is_fork)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, 999123, 'sample-service', 'role-tester/sample-service', 'A Go & Docker service', 'Go', 'https://github.com/role-tester/sample-service', 'role-tester', 0]
    );

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      const urlStr = String(url);
      if (urlStr.includes('api.github.com')) {
        if (urlStr.includes('/languages')) {
          return new Response(JSON.stringify({ Go: 50000 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr.includes('/contents/package.json') || urlStr.includes('/contents/pom.xml')) {
          return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        if (urlStr.match(/role-tester\/sample-service\/contents(\?|$)/)) {
          return new Response(
            JSON.stringify([{ name: 'Dockerfile', path: 'Dockerfile', type: 'file' }]),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
      return originalFetch(url, options);
    };

    const runRes = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(runRes.status === 200, 'POST /api/analysis/run succeeds with expanded catalog');

    const snapshotsRes = await request('/api/analysis/snapshots', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(snapshotsRes.status === 200, 'GET /api/analysis/snapshots returns 200 OK');
    assert(snapshotsRes.data?.data?.length >= 30, `Snapshots created across expanded roles (recorded ${snapshotsRes.data?.data?.length} snapshots)`);

    // Verify Go Developer snapshot matched Go and Docker
    const goSnapshot = snapshotsRes.data?.data?.find((s) => s.roleName === 'Go Developer');
    assert(!!goSnapshot, 'Snapshot recorded for Go Developer role');
    assert((goSnapshot?.readinessScore || 0) > 0, 'Go Developer coverage score is > 0');
    assert(goSnapshot?.analysisSummary?.matchedSkills >= 1, 'analysisSummary shows at least 1 matched skill');
    assert(goSnapshot?.analysisSummary?.note?.includes('evidence coverage'), 'analysisSummary maintains evidence coverage note');

    globalThis.fetch = originalFetch;

  } catch (err) {
    console.error('Unhandled Test Runner Error:', err);
    failed++;
  } finally {
    console.log('\n[Cleanup] Cleaning up test user and repositories...');
    try {
      if (userId) {
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
      }
    } catch (_) {}

    if (server) {
      server.close();
    }

    console.log('====================================================');
    console.log(`📊 Role Catalog Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runRoleCatalogTests();
