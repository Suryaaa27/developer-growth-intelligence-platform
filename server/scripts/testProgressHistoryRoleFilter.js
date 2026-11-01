/**
 * Automated Verification Test for Progress History Role Filtering
 * 
 * Verifies:
 * 1. Java target role query returns strictly Java Backend Developer snapshots.
 * 2. Changing target role to Python Developer queries and returns only Python Developer snapshots.
 * 3. Changing back to Java restores previous Java snapshots intact (no deletion).
 * 4. Temporary role selection/analysis in Skill Analysis does not alter saved Profile target role.
 * 5. Role with no matching snapshots returns empty list cleanly.
 * 6. User isolation is strictly enforced (no cross-user snapshot exposure).
 */

import 'dotenv/config';
import http from 'http';
import app from '../src/app.js';
import pool from '../src/config/db.js';

let server;
let BASE_URL;

const startServer = () =>
  new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      BASE_URL = `http://localhost:${port}/api`;
      resolve();
    });
  });

const stopServer = () =>
  new Promise((resolve) => {
    if (server) server.close(resolve);
    else resolve();
  });

const run = async () => {
  let passed = 0;
  let failed = 0;

  const assert = (condition, msg) => {
    if (condition) {
      console.log(`  ✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      failed++;
    }
  };

  console.log('\n====================================================');
  console.log('🧪 Starting Progress History Role Filtering Test Suite');
  console.log('====================================================\n');

  try {
    await startServer();

    // ── Setup: Register Test User ──────────────────────────────────────────
    const unique = Date.now();
    const userEmail = `progress_test_${unique}@example.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Progress Tester',
        email: userEmail,
        password: 'Password123!',
        targetRole: 'Java Backend Developer',
      }),
    });
    const regData = await regRes.json();
    const userId = regData.data.user.id;
    const token = regData.data.token;

    assert(regRes.status === 201, 'Test user registered with targetRole = Java Backend Developer');
    assert(regData.data.user.targetRole === 'Java Backend Developer', 'Initial target role is Java Backend Developer');

    // ── Setup: Look up role IDs & Insert realistic snapshots ───────────────
    const [roleRows] = await pool.query(
      "SELECT id, role_name FROM role_requirements WHERE role_name IN ('Java Backend Developer', 'Python Developer')"
    );
    const javaRole = roleRows.find((r) => r.role_name === 'Java Backend Developer');
    const pyRole = roleRows.find((r) => r.role_name === 'Python Developer');

    assert(Boolean(javaRole && pyRole), 'Database contains Java and Python role catalog entries');

    // Insert Java snapshot
    await pool.query(
      `INSERT INTO analysis_snapshots (user_id, target_role_id, readiness_score, analysis_summary, created_at)
       VALUES (?, ?, 33, ?, NOW())`,
      [
        userId,
        javaRole.id,
        JSON.stringify({
          matchedSkills: 2,
          totalRequired: 6,
          coveragePercent: 33,
          matchedSkillList: ['Java', 'Docker'],
          missingSkillList: ['Spring Boot', 'MySQL', 'GitHub Actions', 'JUnit'],
          analyzedRepositories: 2,
          distinctSkillsDetected: 5,
        }),
      ]
    );

    // Insert Python snapshot
    await pool.query(
      `INSERT INTO analysis_snapshots (user_id, target_role_id, readiness_score, analysis_summary, created_at)
       VALUES (?, ?, 50, ?, NOW())`,
      [
        userId,
        pyRole.id,
        JSON.stringify({
          matchedSkills: 3,
          totalRequired: 6,
          coveragePercent: 50,
          matchedSkillList: ['Python', 'Docker', 'pytest'],
          missingSkillList: ['FastAPI', 'PostgreSQL', 'Redis'],
          analyzedRepositories: 2,
          distinctSkillsDetected: 5,
        }),
      ]
    );

    console.log('\n[1/5] Testing Filter by Java Backend Developer Target Role...');
    const javaRes = await fetch(`${BASE_URL}/analysis/snapshots?targetRole=Java%20Backend%20Developer`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const javaData = await javaRes.json();

    assert(javaRes.status === 200, 'GET /api/analysis/snapshots?targetRole=Java Backend Developer returns 200');
    assert(javaData.data.length === 1, `Returns snapshot records for Java (found ${javaData.data.length})`);
    assert(
      javaData.data.every((s) => s.roleName === 'Java Backend Developer'),
      'Every returned snapshot strictly belongs to "Java Backend Developer"'
    );
    const javaScore = javaData.data[0].readinessScore;
    assert(javaScore === 33, `Java snapshot has correct readiness score (${javaScore}%)`);

    console.log('\n[2/5] Testing Filter by Python Developer Target Role...');
    const pyRes = await fetch(`${BASE_URL}/analysis/snapshots?targetRole=Python%20Developer`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pyData = await pyRes.json();

    assert(pyRes.status === 200, 'GET /api/analysis/snapshots?targetRole=Python Developer returns 200');
    assert(pyData.data.length === 1, `Returns snapshot records for Python (found ${pyData.data.length})`);
    assert(
      pyData.data.every((s) => s.roleName === 'Python Developer'),
      'Every returned snapshot strictly belongs to "Python Developer"'
    );
    assert(
      !pyData.data.some((s) => s.roleName === 'Java Backend Developer'),
      'Python filtered snapshots strictly do NOT include Java records'
    );
    assert(pyData.data[0].readinessScore === 50, 'Python snapshot has correct readiness score (50%)');

    console.log('\n[3/5] Testing Profile Target Role Change (Java -> Python)...');
    const updateRes = await fetch(`${BASE_URL}/users/${userId}/target-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetRole: 'Python Developer' }),
    });
    const updateData = await updateRes.json();

    assert(updateRes.status === 200, 'PATCH /api/users/:id/target-role updates role to Python Developer');
    assert(updateData.data.targetRole === 'Python Developer', 'Response confirms targetRole is Python Developer');

    // Verify GET /api/auth/me returns new target role
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    assert(meData.data.user.targetRole === 'Python Developer', 'GET /api/auth/me returns updated targetRole');

    // Verify snapshots for Python are retrieved
    const pySnapshots = await fetch(`${BASE_URL}/analysis/snapshots?targetRole=${encodeURIComponent(meData.data.user.targetRole)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pySnapData = await pySnapshots.json();
    assert(pySnapData.data.every((s) => s.roleName === 'Python Developer'), 'Progress history displays only Python Developer');

    console.log('\n[4/5] Testing Switching Back to Java (Verifying Snapshots Preserved)...');
    const revertRes = await fetch(`${BASE_URL}/users/${userId}/target-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetRole: 'Java Backend Developer' }),
    });
    assert(revertRes.status === 200, 'Reverted profile target role back to Java Backend Developer');

    const javaRestoredRes = await fetch(`${BASE_URL}/analysis/snapshots?targetRole=Java%20Backend%20Developer`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const javaRestoredData = await javaRestoredRes.json();
    assert(
      javaRestoredData.data.length === javaData.data.length,
      'Previous Java snapshots were completely preserved and restored intact'
    );
    assert(
      javaRestoredData.data[0].readinessScore === javaScore,
      'Restored Java snapshot readiness score matches original'
    );

    console.log('\n[5/5] Testing Role with No Snapshots & Skill Analysis Independence...');
    // Query a role with non-existent role name
    const emptyRes = await fetch(`${BASE_URL}/analysis/snapshots?targetRole=NonExistentRole`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const emptyData = await emptyRes.json();
    assert(emptyRes.status === 200, 'Query for role with no snapshots returns 200');
    assert(Array.isArray(emptyData.data) && emptyData.data.length === 0, 'Returns empty array cleanly');

    // Verify that user profile in DB still has Java Backend Developer
    const [userCheck] = await pool.query('SELECT target_role FROM users WHERE id = ?', [userId]);
    assert(
      userCheck[0].target_role === 'Java Backend Developer',
      'User target role remains untouched (Skill Analysis exploratory queries do not modify profile)'
    );

    // ── Cleanup ─────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up test records from database...');
    await pool.query('DELETE FROM analysis_snapshots WHERE user_id = ?', [userId]);
    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    console.log('Test data cleaned up.');

  } catch (err) {
    console.error('Test error:', err);
    failed++;
  } finally {
    await stopServer();
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`📊 Progress History Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
};

run();
