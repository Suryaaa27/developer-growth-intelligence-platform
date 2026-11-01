/**
 * Dedicated Test Suite for Learning Roadmap
 *
 * Verifies:
 * 1. Role-specific roadmap generation (Java Backend vs Python Data Engineer vs Frontend).
 * 2. Unanalyzed users receive full roadmap based on role requirements.
 * 3. Skill evidence integration (marks Evidence Detected vs Needs Learning).
 * 4. Evidence does NOT automatically mark tasks as Completed.
 * 5. Missing skills prioritized with High/Core priority.
 * 6. User-specific progress persistence (PATCH /api/roadmap/tasks/:taskKey).
 * 7. Progress persistence across sessions/logins.
 * 8. Role switching preserves separate progress per role.
 * 9. Multi-user isolation (User 1 cannot see or overwrite User 2's progress).
 * 10. Duplicate task prevention (all task IDs unique).
 * 11. Authentication enforcement (401 without token).
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
  console.log('🧪 Starting Learning Roadmap Test Suite');
  console.log('====================================================\n');

  try {
    await startServer();

    // ── 1. Authentication Enforcement ───────────────────────────────────
    console.log('[1/7] Testing Authentication Enforcement on /api/roadmap...');
    const unauthGet = await fetch(`${BASE_URL}/roadmap`);
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/roadmap returns 401 Unauthorized');

    const unauthPatch = await fetch(`${BASE_URL}/roadmap/tasks/task-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(unauthPatch.status === 401, 'Unauthenticated PATCH /api/roadmap/tasks/:taskKey returns 401 Unauthorized');

    // ── Setup: Register User 1 & User 2 ─────────────────────────────────
    const ts = Date.now();
    const u1Email = `roadmap_user1_${ts}@example.com`;
    const u2Email = `roadmap_user2_${ts}@example.com`;

    const reg1Res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Roadmap Alice',
        email: u1Email,
        password: 'Password123!',
        targetRole: 'Java Backend Developer',
      }),
    });
    const reg1 = await reg1Res.json();
    const user1Id = reg1.data.user.id;
    const user1Token = reg1.data.token;

    const reg2Res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Roadmap Bob',
        email: u2Email,
        password: 'Password123!',
        targetRole: 'Frontend Developer',
      }),
    });
    const reg2 = await reg2Res.json();
    const user2Id = reg2.data.user.id;
    const user2Token = reg2.data.token;

    assert(Boolean(user1Id && user2Id), 'Registered two test users with different target roles');

    // ── 2. Unanalyzed User Roadmap Generation ───────────────────────────
    console.log('\n[2/7] Testing Roadmap Generation for Unanalyzed User...');
    const r1 = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const d1 = await r1.json();

    assert(r1.status === 200, 'GET /api/roadmap returns 200 OK');
    assert(d1.data.targetRole === 'Java Backend Developer', 'Target role matches user saved role');
    assert(Array.isArray(d1.data.tasks) && d1.data.tasks.length >= 5, `Generated complete tasks for Java (${d1.data.tasks.length} tasks)`);
    assert(Array.isArray(d1.data.stages) && d1.data.stages.length >= 3, `Generated structured stages (${d1.data.stages.length} stages)`);
    assert(
      d1.data.tasks.some((t) => t.skillName === 'Java' || t.title.includes('Java')),
      'Java Backend roadmap contains Java skill task'
    );
    assert(
      d1.data.tasks.some((t) => t.skillName === 'Spring Boot' || t.title.includes('Spring Boot')),
      'Java Backend roadmap contains Spring Boot task'
    );
    assert(
      d1.data.tasks.every((t) => t.evidenceStatus === 'Needs Learning'),
      'All tasks marked "Needs Learning" when user has 0 repository evidence'
    );
    assert(
      d1.data.tasks.every((t) => t.status === 'NOT_STARTED' && !t.completed),
      'All tasks initially have status NOT_STARTED and completed = false'
    );

    // ── 3. Duplicate Task Prevention ────────────────────────────────────
    console.log('\n[3/7] Testing Duplicate Task Prevention...');
    const taskIds = d1.data.tasks.map((t) => t.id);
    const uniqueIds = new Set(taskIds);
    assert(taskIds.length === uniqueIds.size, 'All generated task IDs are strictly unique (no duplicates)');

    // ── 4. Skill Evidence Integration ───────────────────────────────────
    console.log('\n[4/7] Testing Skill Evidence Integration & Prioritization...');
    // Provision repository and detected Java evidence for User 1
    const [repoResult] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, owner_login, primary_language, html_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [user1Id, 888801, 'my-java-app', 'alice/my-java-app', 'alice', 'Java', 'https://github.com/alice/my-java-app']
    );
    const repoId = repoResult.insertId;

    await pool.query(
      `INSERT INTO skill_evidence (repository_id, skill_name, evidence_type, evidence_details, confidence_score, detected_at)
       VALUES (?, 'Java', 'language_bytes', 'Detected in repository', 90, NOW())`,
      [repoId]
    );

    const r1WithEvidence = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const d1WithEvidence = await r1WithEvidence.json();

    const javaTask = d1WithEvidence.data.tasks.find((t) => t.skillName === 'Java');
    const springTask = d1WithEvidence.data.tasks.find((t) => t.skillName === 'Spring Boot');

    assert(Boolean(javaTask && springTask), 'Found Java and Spring Boot tasks in refreshed roadmap');
    assert(javaTask.evidenceStatus === 'Evidence Detected', 'Java task classified as "Evidence Detected"');
    assert(springTask.evidenceStatus === 'Needs Learning', 'Spring Boot task classified as "Needs Learning"');
    assert(
      !javaTask.completed && javaTask.status === 'NOT_STARTED',
      'IMPORTANT: Repository evidence does NOT automatically mark learning task completed'
    );
    assert(springTask.priority === 'Core' || springTask.priority === 'High', 'Missing skill prioritized as Core/High');

    // ── 5. Persistent Task Progress & Session Retention ─────────────────
    console.log('\n[5/7] Testing Task Progress Persistence Across Logins...');
    // Mark Java task as IN_PROGRESS
    const patch1 = await fetch(`${BASE_URL}/roadmap/tasks/${javaTask.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ roleId: d1WithEvidence.data.targetRoleId, status: 'IN_PROGRESS' }),
    });
    const patch1Data = await patch1.json();
    assert(patch1.status === 200, 'PATCH /api/roadmap/tasks/:taskKey returns 200 OK');
    assert(patch1Data.data.status === 'IN_PROGRESS', 'Task status set to IN_PROGRESS');

    // Mark Spring Boot task as COMPLETED
    const patch2 = await fetch(`${BASE_URL}/roadmap/tasks/${springTask.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ roleId: d1WithEvidence.data.targetRoleId, status: 'COMPLETED' }),
    });
    const patch2Data = await patch2.json();
    assert(patch2.status === 200, 'Marking task COMPLETED returns 200 OK');
    assert(patch2Data.data.status === 'COMPLETED', 'Task status set to COMPLETED');
    assert(Boolean(patch2Data.data.completedAt), 'Completed task records completedAt timestamp');

    // Simulate login again with User 1 credentials
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u1Email, password: 'Password123!' }),
    });
    const loginData = await loginRes.json();
    const newSessionToken = loginData.data.token;

    const r1PostLogin = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${newSessionToken}` },
    });
    const d1PostLogin = await r1PostLogin.json();

    const javaAfterLogin = d1PostLogin.data.tasks.find((t) => t.id === javaTask.id);
    const springAfterLogin = d1PostLogin.data.tasks.find((t) => t.id === springTask.id);

    assert(javaAfterLogin.status === 'IN_PROGRESS', 'Java task retained IN_PROGRESS status after fresh login');
    assert(springAfterLogin.status === 'COMPLETED' && springAfterLogin.completed, 'Spring Boot task retained COMPLETED status after fresh login');
    assert(d1PostLogin.data.stats.completedTasks === 1, 'Stats accurately reflects 1 completed task');
    assert(d1PostLogin.data.stats.completionPercentage > 0, 'Completion percentage accurately calculated');

    // ── 6. Multi-User Isolation ─────────────────────────────────────────
    console.log('\n[6/7] Testing Multi-User Progress Isolation...');
    const r2 = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const d2 = await r2.json();

    assert(d2.data.targetRole === 'Frontend Developer', 'User 2 target role is Frontend Developer');
    assert(
      d2.data.tasks.some((t) => t.skillName === 'React' || t.title.includes('React')),
      'User 2 roadmap contains Frontend specific skills (React)'
    );
    assert(
      d2.data.stats.completedTasks === 0,
      'User 2 has 0 completed tasks (User 1 progress is completely isolated)'
    );

    // ── 7. Role Switching & Progress Preservation ────────────────────────
    console.log('\n[7/7] Testing Role Switching and Progress Preservation...');
    // User 1 switches role to Python Data Engineer
    await fetch(`${BASE_URL}/users/${user1Id}/target-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ targetRole: 'Python Data Engineer' }),
    });

    const r1Python = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const d1Python = await r1Python.json();
    assert(d1Python.data.targetRole === 'Python Data Engineer', 'Roadmap reflects newly saved Python Data Engineer role');
    assert(
      d1Python.data.tasks.some((t) => t.skillName === 'Python' || t.title.includes('Python')),
      'Roadmap now generates Python Data Engineer specific competencies'
    );
    assert(d1Python.data.stats.completedTasks === 0, 'Python role starts with 0 completed tasks');

    // Switch User 1 back to Java Backend Developer
    await fetch(`${BASE_URL}/users/${user1Id}/target-role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ targetRole: 'Java Backend Developer' }),
    });

    const r1JavaRestored = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const d1JavaRestored = await r1JavaRestored.json();
    const springRestored = d1JavaRestored.data.tasks.find((t) => t.id === springTask.id);

    assert(d1JavaRestored.data.targetRole === 'Java Backend Developer', 'Roadmap returned to Java Backend Developer');
    assert(springRestored.status === 'COMPLETED' && springRestored.completed, 'Java saved task progress was completely preserved and restored');

    // ── Cleanup ─────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Cleaning up test records...');
    await pool.query('DELETE FROM user_roadmap_progress WHERE user_id IN (?, ?)', [user1Id, user2Id]);
    await pool.query('DELETE FROM skill_evidence WHERE repository_id = ?', [repoId]);
    await pool.query('DELETE FROM repositories WHERE id = ?', [repoId]);
    await pool.query('DELETE FROM users WHERE id IN (?, ?)', [user1Id, user2Id]);
    console.log('Test data cleaned up.');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    await stopServer();
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`📊 Learning Roadmap Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
};

run();

