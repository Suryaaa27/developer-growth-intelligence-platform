/**
 * Dedicated Automated Test Suite: Admin Recommendation Templates Integration
 *
 * Verifies:
 * 1. Unauthenticated request to GET /api/recommendations returns 401 Unauthorized.
 * 2. Authenticated GET /api/recommendations?skills=Docker returns matching Docker template.
 * 3. Non-matching skills return empty list gracefully with 200 OK.
 * 4. Multiple skills query (?skills=Docker,React) returns both matching templates without duplicates.
 * 5. Role-based request GET /api/recommendations?roleId=... returns recommendations for missing skills.
 * 6. Empty / missing query parameters handled gracefully.
 * 7. SQL injection attempts are safely parameterized and handled.
 * 8. User target role and profile state are NEVER modified by recommendation queries.
 * 9. Real-time Admin updates: new templates created by Admin are immediately visible via /api/recommendations.
 * 10. Learning Roadmap task enrichment: tasks reflect admin template resourceUrl and learningGuidance.
 */

import 'dotenv/config';
import http from 'http';
import bcrypt from 'bcryptjs';
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
  console.log('🧪 Starting Recommendations Integration Test Suite');
  console.log('====================================================\n');

  let testUserId = null;
  let testAdminId = null;
  let createdTemplateId = null;

  try {
    await startServer();

    // ── 1. Authentication Enforcement ───────────────────────────────────
    console.log('[1/10] Testing Authentication Enforcement on /api/recommendations...');
    const unauthGet = await fetch(`${BASE_URL}/recommendations?skills=Docker`);
    const unauthJson = await unauthGet.json().catch(() => ({}));
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/recommendations returns 401');
    assert(unauthJson.success === false, 'Unauthenticated response indicates success: false');

    // ── Setup: Create Test User and Test Admin ───────────────────────────
    const ts = Date.now();
    const userEmail = `rec_user_${ts}@example.com`;
    const adminEmail = `rec_admin_${ts}@example.com`;
    const passwordHash = await bcrypt.hash('TestPass123!', 10);

    const [userInsert] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, target_role, is_active)
       VALUES (?, ?, ?, 'USER', 'Java Backend Developer', 1)`,
      ['Rec Test User', userEmail, passwordHash]
    );
    testUserId = userInsert.insertId;

    const [adminInsert] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, target_role, is_active)
       VALUES (?, ?, ?, 'ADMIN', 'Software Architect', 1)`,
      ['Rec Test Admin', adminEmail, passwordHash]
    );
    testAdminId = adminInsert.insertId;

    // Login user
    const userLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password: 'TestPass123!' }),
    });
    const userLoginData = await userLoginRes.json();
    const userToken = userLoginData?.data?.token;

    // Login admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'TestPass123!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData?.data?.token;

    assert(Boolean(userToken && adminToken), 'Successfully authenticated test user and test admin');

    // Ensure a Docker template exists in recommendation_templates for deterministic tests
    const [existingDocker] = await pool.query(
      'SELECT id, skill_name, title FROM recommendation_templates WHERE skill_name = ?',
      ['Docker']
    );
    if (existingDocker.length === 0) {
      await pool.query(
        `INSERT INTO recommendation_templates (skill_name, title, description, resource_url, priority)
         VALUES ('Docker', 'Docker Containerization Guide', 'Learn container fundamentals and multi-stage builds', 'https://docs.docker.com/get-started/', 'HIGH')`
      );
    }

    // ── 2. Authenticated Single Matching Skill Query ─────────────────────
    console.log('\n[2/10] Testing Single Matching Skill Query...');
    const singleRes = await fetch(`${BASE_URL}/recommendations?skills=Docker`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const singleData = await singleRes.json();

    assert(singleRes.status === 200, 'GET /api/recommendations?skills=Docker returns 200 OK');
    assert(singleData.success === true, 'Response payload success is true');
    assert(Array.isArray(singleData.data) && singleData.data.length >= 1, 'Returns array containing matching template');
    const dockerMatch = singleData.data.find((r) => (r.skillName || '').toLowerCase().includes('docker'));
    assert(Boolean(dockerMatch), 'Matched template includes Docker skillName');
    assert(Boolean(dockerMatch?.title && dockerMatch?.description && dockerMatch?.resourceUrl), 'Template contains title, description, and resourceUrl');

    // ── 3. Graceful Fallback for Non-Matching Skill ──────────────────────
    console.log('\n[3/10] Testing Non-Matching Skill Query...');
    const nonMatchRes = await fetch(`${BASE_URL}/recommendations?skills=UnknownQuantumSkill999`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const nonMatchData = await nonMatchRes.json();

    assert(nonMatchRes.status === 200, 'GET /api/recommendations with unknown skill returns 200 OK');
    assert(nonMatchData.success === true, 'Response success is true');
    assert(Array.isArray(nonMatchData.data), 'Data is an array');
    assert(nonMatchData.data.length === 0, 'No matching templates returns empty array without throwing error');

    // ── 4. Multiple Skills Query & Deduplication ────────────────────────
    console.log('\n[4/10] Testing Multiple Skills Query with Deduplication...');
    // Seed React template if not present
    const [existingReact] = await pool.query(
      'SELECT id FROM recommendation_templates WHERE skill_name = ?',
      ['React']
    );
    if (existingReact.length === 0) {
      await pool.query(
        `INSERT INTO recommendation_templates (skill_name, title, description, resource_url, priority)
         VALUES ('React', 'React Foundations & State Management', 'Master modern React functional components and hooks', 'https://react.dev/learn', 'HIGH')`
      );
    }

    const multiRes = await fetch(`${BASE_URL}/recommendations?skills=Docker,React,Docker`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const multiData = await multiRes.json();

    assert(multiRes.status === 200, 'GET /api/recommendations?skills=Docker,React,Docker returns 200 OK');
    assert(Array.isArray(multiData.data), 'Returns array of recommendation templates');
    const ids = multiData.data.map((r) => r.id);
    const uniqueIds = new Set(ids);
    assert(ids.length === uniqueIds.size, 'No duplicate templates returned when skill requested twice');
    assert(multiData.data.some((r) => (r.skillName || '').toLowerCase().includes('docker')), 'Contains Docker template');
    assert(multiData.data.some((r) => (r.skillName || '').toLowerCase().includes('react')), 'Contains React template');

    // ── 5. Role-Based Recommendations Query ──────────────────────────────
    console.log('\n[5/10] Testing Role-Based Recommendations Query...');
    const [roleRows] = await pool.query(
      'SELECT id, role_name, required_skills FROM role_requirements LIMIT 1'
    );
    const targetTestRole = roleRows[0];

    const roleRes = await fetch(`${BASE_URL}/recommendations?roleId=${targetTestRole.id}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const roleData = await roleRes.json();

    assert(roleRes.status === 200, 'GET /api/recommendations?roleId=... returns 200 OK');
    assert(roleData.success === true, 'Response is successful');
    assert(Array.isArray(roleData.data), 'Returns list of recommendations for target role competencies');

    // ── 6. Empty / Missing Query Parameters ──────────────────────────────
    console.log('\n[6/10] Testing Empty & Missing Query Parameters...');
    const emptyQueryRes = await fetch(`${BASE_URL}/recommendations`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const emptyQueryData = await emptyQueryRes.json();

    assert(emptyQueryRes.status === 200, 'GET /api/recommendations with no params returns 200 OK');
    assert(Array.isArray(emptyQueryData.data), 'Returns an array structure gracefully');

    const blankSkillRes = await fetch(`${BASE_URL}/recommendations?skills=`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const blankSkillData = await blankSkillRes.json();
    assert(blankSkillRes.status === 200, 'GET /api/recommendations?skills= returns 200 OK');
    assert(Array.isArray(blankSkillData.data), 'Returns array without server error');

    // ── 7. SQL Injection Resilience ──────────────────────────────────────
    console.log('\n[7/10] Testing SQL Injection Resilience...');
    const sqlPayload = "' OR '1'='1' -- ; DROP TABLE recommendation_templates;";
    const sqliRes = await fetch(`${BASE_URL}/recommendations?skills=${encodeURIComponent(sqlPayload)}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const sqliData = await sqliRes.json();

    assert(sqliRes.status === 200, 'SQL injection attempt handled safely without 500 database error');
    assert(sqliData.success === true, 'API returned valid JSON response');
    const [tableCheck] = await pool.query('SHOW TABLES LIKE "recommendation_templates"');
    assert(tableCheck.length === 1, 'Database table intact after injection payload attempt');

    // ── 8. Non-Destructive Target Role State ──────────────────────────────
    console.log('\n[8/10] Verifying Profile State & Target Role Invariance...');
    const [beforeUser] = await pool.query('SELECT target_role, target_role_id FROM users WHERE id = ?', [testUserId]);
    await fetch(`${BASE_URL}/recommendations?roleId=99999&skills=Go,Kubernetes`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const [afterUser] = await pool.query('SELECT target_role, target_role_id FROM users WHERE id = ?', [testUserId]);

    assert(beforeUser[0].target_role === afterUser[0].target_role, 'User target_role was NOT changed by exploratory recommendations query');
    assert(beforeUser[0].target_role_id === afterUser[0].target_role_id, 'User target_role_id was NOT changed');

    // ── 9. Dynamic Admin Updates Reflection ─────────────────────────────
    console.log('\n[9/10] Testing Real-Time Admin Creation Reflection...');
    const dynamicSkill = `GraphQL-${ts}`;
    const createRes = await fetch(`${BASE_URL}/admin/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        skillName: dynamicSkill,
        title: 'GraphQL Schema & Query Federation',
        description: 'Design production GraphQL schemas with Apollo and DataLoader',
        resourceUrl: 'https://graphql.org/learn/',
        priority: 'CRITICAL',
      }),
    });
    const createData = await createRes.json();
    assert(createRes.status === 201, 'Admin successfully created new recommendation template (201 Created)');
    createdTemplateId = createData?.data?.id;

    // Developer queries this newly created template immediately
    const devQueryRes = await fetch(`${BASE_URL}/recommendations?skills=${encodeURIComponent(dynamicSkill)}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const devQueryData = await devQueryRes.json();
    assert(devQueryRes.status === 200, 'Developer can immediately query newly created template');
    const matchedNew = devQueryData.data.find((r) => r.skillName === dynamicSkill);
    assert(Boolean(matchedNew), 'Developer retrieved the exact newly created Admin template');
    assert(matchedNew?.priority === 'CRITICAL', 'Retrieved template preserves Admin-assigned CRITICAL priority');

    // ── 10. Learning Roadmap Task Enrichment ────────────────────────────
    console.log('\n[10/10] Verifying Learning Roadmap Task Enrichment...');
    const roadmapRes = await fetch(`${BASE_URL}/roadmap`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const roadmapData = await roadmapRes.json();

    assert(roadmapRes.status === 200, 'GET /api/roadmap returns 200 OK');
    const tasks = roadmapData?.data?.tasks || [];
    assert(tasks.length > 0, `Roadmap contains ${tasks.length} tasks`);

    // Verify task properties
    const sampleTask = tasks[0];
    assert('deliverable' in sampleTask, 'Task includes deliverable field');
    assert('resourceUrl' in sampleTask, 'Task includes resourceUrl field');
    assert('learningGuidance' in sampleTask, 'Task includes learningGuidance field');

    const enrichedTask = tasks.find((t) => t.learningGuidance !== null);
    if (enrichedTask) {
      assert(Boolean(enrichedTask.learningGuidance.title), 'Enriched task has learning guidance title from template');
      assert(Boolean(enrichedTask.learningGuidance.priority), 'Enriched task has learning guidance priority from template');
    } else {
      console.log('  ℹ️ Note: No task matched existing template names; learningGuidance is gracefully null');
    }

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    // Cleanup
    if (createdTemplateId) {
      await pool.query('DELETE FROM recommendation_templates WHERE id = ?', [createdTemplateId]).catch(() => {});
    }
    if (testUserId) {
      await pool.query('DELETE FROM user_roadmap_progress WHERE user_id = ?', [testUserId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id = ?', [testUserId]).catch(() => {});
    }
    if (testAdminId) {
      await pool.query('DELETE FROM users WHERE id = ?', [testAdminId]).catch(() => {});
    }

    await stopServer();
    await pool.end();

    console.log('\n====================================================');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

run();

