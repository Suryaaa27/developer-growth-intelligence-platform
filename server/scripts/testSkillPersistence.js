import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../src/config/db.js';
import app from '../src/app.js';

const TEST_PORT = 5006;
const baseUrl = `http://localhost:${TEST_PORT}`;

// Test Users
const aliceData = {
  name: 'Alice Developer',
  email: `alice_test_${Date.now()}@example.com`,
  password: 'Password123!',
  githubUsername: 'alice',
};

const bobData = {
  name: 'Bob Engineer',
  email: `bob_test_${Date.now()}@example.com`,
  password: 'Password123!',
  githubUsername: 'bob',
};

const charlieData = {
  name: 'Charlie ZeroRepo',
  email: `charlie_test_${Date.now()}@example.com`,
  password: 'Password123!',
  githubUsername: 'charlie',
};

let aliceId = null;
let aliceToken = null;
let bobId = null;
let bobToken = null;
let charlieId = null;
let charlieToken = null;

let aliceRepo1Id = null;
let aliceRepo2Id = null;
let bobRepo1Id = null;

let server = null;
let mockScenario = 'NORMAL'; // 'NORMAL', 'RATE_LIMITED'

const originalFetch = globalThis.fetch;

// Intercept fetch calls to api.github.com for deterministic testing
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  if (urlStr.includes('api.github.com')) {
    if (mockScenario === 'RATE_LIMITED') {
      return new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '0',
        },
      });
    }

    if (urlStr.includes('alice/non-existent-repository-404')) {
      return new Response(JSON.stringify({ message: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Alice Repo 1: alice/ecommerce-web (JS, TS, React, Express, Dockerfile)
    if (urlStr.includes('alice/ecommerce-web/languages')) {
      return new Response(
        JSON.stringify({
          JavaScript: 160000,
          TypeScript: 40000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.includes('alice/ecommerce-web/contents/package.json')) {
      const pkg = JSON.stringify({
        name: 'ecommerce-web',
        dependencies: {
          react: '^18.2.0',
          express: '^4.18.2',
        },
        devDependencies: {
          jest: '^29.5.0',
        },
      });
      return new Response(
        JSON.stringify({
          encoding: 'base64',
          size: pkg.length,
          content: Buffer.from(pkg).toString('base64') + '\n',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.includes('alice/ecommerce-web/contents/pom.xml')) {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    }

    if (urlStr.match(/alice\/ecommerce-web\/contents(\?|$)/)) {
      return new Response(
        JSON.stringify([
          { name: 'Dockerfile', path: 'Dockerfile', type: 'file' },
          { name: 'package.json', path: 'package.json', type: 'file' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Alice Repo 2: alice/backend-service (Java, Spring Boot, docker-compose)
    if (urlStr.includes('alice/backend-service/languages')) {
      return new Response(
        JSON.stringify({
          Java: 250000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.includes('alice/backend-service/contents/package.json')) {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    }

    if (urlStr.includes('alice/backend-service/contents/pom.xml')) {
      const pom = `
        <project>
          <dependencies>
            <dependency>
              <groupId>org.springframework.boot</groupId>
              <artifactId>spring-boot-starter-web</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;
      return new Response(
        JSON.stringify({
          encoding: 'base64',
          size: pom.length,
          content: Buffer.from(pom).toString('base64') + '\n',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.match(/alice\/backend-service\/contents(\?|$)/)) {
      return new Response(
        JSON.stringify([
          { name: 'pom.xml', path: 'pom.xml', type: 'file' },
          { name: 'docker-compose.yml', path: 'docker-compose.yml', type: 'file' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Bob Repo: bob/data-pipeline (Python, requirements.txt)
    if (urlStr.includes('bob/data-pipeline/languages')) {
      return new Response(
        JSON.stringify({
          Python: 180000,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.includes('bob/data-pipeline/contents/package.json') || urlStr.includes('bob/data-pipeline/contents/pom.xml')) {
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    }

    if (urlStr.match(/bob\/data-pipeline\/contents(\?|$)/)) {
      return new Response(
        JSON.stringify([
          { name: 'requirements.txt', path: 'requirements.txt', type: 'file' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify([]), { status: 200 });
  }

  // Pass-through to original fetch for local express server
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

const runSkillPersistenceTests = async () => {
  console.log('====================================================');
  console.log('🧪 Starting Phase 1B Skill Persistence & API Tests');
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
    // 0. Setup: Start server on TEST_PORT and seed database
    console.log('[Setup] Starting test server and provisioning test data...');
    server = app.listen(TEST_PORT);

    const hashedPwd = await bcrypt.hash(aliceData.password, 10);

    // Create Alice
    const [aliceRes] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [aliceData.name, aliceData.email, hashedPwd, 'USER', 1, 999101, aliceData.githubUsername]
    );
    aliceId = aliceRes.insertId;

    // Create Bob
    const [bobRes] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [bobData.name, bobData.email, hashedPwd, 'USER', 1, 999102, bobData.githubUsername]
    );
    bobId = bobRes.insertId;

    // Create Charlie (No repos)
    const [charlieRes] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [charlieData.name, charlieData.email, hashedPwd, 'USER', 1, 999103, charlieData.githubUsername]
    );
    charlieId = charlieRes.insertId;

    // Login users to acquire JWT tokens
    const loginAlice = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: aliceData.email, password: aliceData.password }),
    });
    aliceToken = loginAlice.data?.data?.token;

    const loginBob = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: bobData.email, password: bobData.password }),
    });
    bobToken = loginBob.data?.data?.token;

    const loginCharlie = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: charlieData.email, password: charlieData.password }),
    });
    charlieToken = loginCharlie.data?.data?.token;

    // Seed Alice's synchronized repositories
    const [repoA1] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [aliceId, 8881, 'ecommerce-web', 'alice/ecommerce-web', 'Frontend and API', 'JavaScript', 'https://github.com/alice/ecommerce-web']
    );
    aliceRepo1Id = repoA1.insertId;

    const [repoA2] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [aliceId, 8882, 'backend-service', 'alice/backend-service', 'Core backend', 'Java', 'https://github.com/alice/backend-service']
    );
    aliceRepo2Id = repoA2.insertId;

    // Seed Bob's synchronized repository
    const [repoB1] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [bobId, 8883, 'data-pipeline', 'bob/data-pipeline', 'Python data pipeline', 'Python', 'https://github.com/bob/data-pipeline']
    );
    bobRepo1Id = repoB1.insertId;

    console.log(`Setup complete. Alice ID: ${aliceId}, Bob ID: ${bobId}, Charlie ID: ${charlieId}\n`);

    // ─────────────────────────────────────────────────────────────
    // 1. Unauthenticated and Security Enforcement
    // ─────────────────────────────────────────────────────────────
    console.log('[1/10] Testing Authentication Enforcement...');
    const unauthRun = await request('/api/analysis/run', { method: 'POST' });
    assert(unauthRun.status === 401, 'POST /api/analysis/run without token returns 401');

    const unauthSkills = await request('/api/skills');
    assert(unauthSkills.status === 401, 'GET /api/skills without token returns 401');

    const unauthSkillEvidence = await request('/api/skills/JavaScript');
    assert(unauthSkillEvidence.status === 401, 'GET /api/skills/:skillName without token returns 401');

    const invalidTokenRes = await request('/api/skills', {
      headers: { Authorization: 'Bearer invalid.token.payload' },
    });
    assert(invalidTokenRes.status === 401, 'Request with invalid token returns 401');

    // ─────────────────────────────────────────────────────────────
    // 2. User with 0 Synchronized Repositories
    // ─────────────────────────────────────────────────────────────
    console.log('\n[2/10] Testing User with 0 Synchronized Repositories...');
    const zeroRepoRun = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert(zeroRepoRun.status === 200, 'POST /api/analysis/run for user with 0 repos returns 200');
    assert(zeroRepoRun.data?.data?.totalRepositories === 0, 'totalRepositories is 0');
    assert(zeroRepoRun.data?.data?.analyzedCount === 0, 'analyzedCount is 0');
    assert(zeroRepoRun.data?.message?.includes('synchronize'), 'Friendly message indicates sync required');

    const zeroRepoSkills = await request('/api/skills', {
      headers: { Authorization: `Bearer ${charlieToken}` },
    });
    assert(zeroRepoSkills.status === 200, 'GET /api/skills for user with 0 skills returns 200');
    assert(Array.isArray(zeroRepoSkills.data?.data), 'skills data is returned as an array');
    assert(zeroRepoSkills.data?.data?.length === 0, 'skills data array is empty for user without evidence');
    assert(zeroRepoSkills.data?.count === 0, 'skills count is 0');

    // ─────────────────────────────────────────────────────────────
    // 3. POST /api/analysis/run: Detection & Persistence
    // ─────────────────────────────────────────────────────────────
    console.log('\n[3/10] Testing POST /api/analysis/run Execution & Database Persistence...');
    mockScenario = 'NORMAL';
    const aliceRunRes = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(aliceRunRes.status === 200, 'Alice analysis run returns 200 OK');
    assert(aliceRunRes.data?.data?.totalRepositories === 2, 'totalRepositories reflects 2 repos');
    assert(aliceRunRes.data?.data?.analyzedCount === 2, 'analyzedCount is 2');
    assert(aliceRunRes.data?.data?.skippedCount === 0, 'skippedCount is 0');
    assert(aliceRunRes.data?.data?.evidenceCount > 0, 'evidenceCount is greater than 0');
    assert(Array.isArray(aliceRunRes.data?.data?.distinctSkills), 'distinctSkills is an array');

    const distinctSkills = aliceRunRes.data?.data?.distinctSkills || [];
    assert(distinctSkills.includes('JavaScript'), 'distinctSkills includes JavaScript');
    assert(distinctSkills.includes('React'), 'distinctSkills includes React');
    assert(distinctSkills.includes('Express.js'), 'distinctSkills includes Express.js');
    assert(distinctSkills.includes('Docker'), 'distinctSkills includes Docker');
    assert(distinctSkills.includes('Java'), 'distinctSkills includes Java');
    assert(distinctSkills.includes('Spring Boot'), 'distinctSkills includes Spring Boot');

    // Verify MySQL rows directly
    const [aliceEvidenceRows] = await pool.query(
      `SELECT se.* FROM skill_evidence se
       JOIN repositories r ON se.repository_id = r.id
       WHERE r.user_id = ?`,
      [aliceId]
    );
    assert(aliceEvidenceRows.length > 0, 'skill_evidence records persisted in MySQL');
    assert(aliceEvidenceRows.length === aliceRunRes.data?.data?.evidenceCount, 'DB count matches response evidenceCount');

    // Verify last_analyzed_at was updated on repositories
    const [aliceReposDb] = await pool.query(
      'SELECT id, last_analyzed_at FROM repositories WHERE user_id = ?',
      [aliceId]
    );
    assert(aliceReposDb.every((r) => r.last_analyzed_at !== null), 'All analyzed repositories have last_analyzed_at set');

    // ─────────────────────────────────────────────────────────────
    // 4. Idempotent Re-analysis (No Duplicate Evidence Rows)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[4/10] Testing Re-analysis Idempotency (Clean Replace Without Duplicates)...');
    const initialEvidenceCount = aliceEvidenceRows.length;

    const repeatRunRes = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(repeatRunRes.status === 200, 'Repeated analysis run returns 200 OK');

    const [aliceEvidenceAfterRepeat] = await pool.query(
      `SELECT se.* FROM skill_evidence se
       JOIN repositories r ON se.repository_id = r.id
       WHERE r.user_id = ?`,
      [aliceId]
    );
    assert(
      aliceEvidenceAfterRepeat.length === initialEvidenceCount,
      `Row count unchanged after re-run (exactly ${initialEvidenceCount} rows, no duplicates)`
    );

    // ─────────────────────────────────────────────────────────────
    // 5. GET /api/skills: Aggregated Skills & Scoring
    // ─────────────────────────────────────────────────────────────
    console.log('\n[5/10] Testing GET /api/skills Aggregated Results...');
    const aliceSkillsRes = await request('/api/skills', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(aliceSkillsRes.status === 200, 'GET /api/skills returns 200 OK');

    const skillsList = aliceSkillsRes.data?.data;
    assert(Array.isArray(skillsList) && skillsList.length > 0, 'Aggregated skills returned as non-empty array');
    assert(aliceSkillsRes.data?.count === skillsList.length, 'Count property matches array length');

    // Verify sorting by confidence score descending
    let isSortedDescending = true;
    for (let i = 0; i < skillsList.length - 1; i++) {
      if (skillsList[i].confidenceScore < skillsList[i + 1].confidenceScore) {
        isSortedDescending = false;
        break;
      }
    }
    assert(isSortedDescending, 'Skills are sorted by confidenceScore descending');

    // Verify properties on a sample skill
    const jsSkill = skillsList.find((s) => s.skillName === 'JavaScript');
    assert(!!jsSkill, 'JavaScript skill present in aggregated list');
    assert(jsSkill.category === 'Language', 'JavaScript category is Language');
    assert(jsSkill.evidenceType === 'language_bytes', 'JavaScript primary evidenceType is language_bytes');
    assert(jsSkill.repositoryCount >= 1, 'JavaScript repositoryCount >= 1');
    assert(Array.isArray(jsSkill.contributingRepositories), 'contributingRepositories is an array');
    assert(!!jsSkill.lastDetectedAt, 'lastDetectedAt timestamp is present');

    const reactSkill = skillsList.find((s) => s.skillName === 'React');
    assert(!!reactSkill, 'React skill present in aggregated list');
    assert(reactSkill.category === 'Framework', 'React category is Framework');

    const dockerSkill = skillsList.find((s) => s.skillName === 'Docker');
    assert(!!dockerSkill, 'Docker skill present in aggregated list');
    assert(dockerSkill.category === 'Tool', 'Docker category is Tool');

    // ─────────────────────────────────────────────────────────────
    // 6. GET /api/skills/:skillName: Granular Evidence Details
    // ─────────────────────────────────────────────────────────────
    console.log('\n[6/10] Testing GET /api/skills/:skillName Evidence Breakdown...');
    const jsEvidenceRes = await request('/api/skills/JavaScript', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(jsEvidenceRes.status === 200, 'GET /api/skills/JavaScript returns 200 OK');
    assert(jsEvidenceRes.data?.data?.skillName === 'JavaScript', 'skillName matches requested skill');
    assert(jsEvidenceRes.data?.data?.category === 'Language', 'category is Language');
    assert(jsEvidenceRes.data?.data?.confidenceScore > 0, 'confidenceScore is positive');
    assert(Array.isArray(jsEvidenceRes.data?.data?.evidence), 'evidence is returned as an array');
    assert(jsEvidenceRes.data?.data?.evidence?.length >= 1, 'At least 1 evidence record returned');

    const firstEv = jsEvidenceRes.data?.data?.evidence[0];
    assert(!!firstEv.repositoryFullName, 'repositoryFullName is present on evidence record');
    assert(!!firstEv.evidenceType, 'evidenceType is present on evidence record');
    assert(!!firstEv.evidenceDetails, 'evidenceDetails is present on evidence record');
    assert(!!firstEv.detectedAt, 'detectedAt is present on evidence record');

    // Case-insensitivity test
    const jsLowerRes = await request('/api/skills/javascript', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(jsLowerRes.status === 200, 'GET /api/skills/javascript (lowercase) returns 200 OK');
    assert(jsLowerRes.data?.data?.skillName === 'JavaScript', 'Returns canonical skill name');

    // ─────────────────────────────────────────────────────────────
    // 7. GET /api/skills/:skillName: 404 & Validation
    // ─────────────────────────────────────────────────────────────
    console.log('\n[7/10] Testing GET /api/skills/:skillName 404 & Input Validation...');
    const notFoundSkill = await request('/api/skills/NonExistentSkillFooBar', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(notFoundSkill.status === 404, 'Non-existent skill returns 404 Not Found');
    assert(notFoundSkill.data?.message?.includes('No evidence found'), '404 contains friendly message');

    const blankSkill = await request('/api/skills/%20%20', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(blankSkill.status === 400, 'Blank/whitespace skillName returns 400 Bad Request');

    // ─────────────────────────────────────────────────────────────
    // 8. User Data Isolation (No Cross-User Leakage)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[8/10] Testing User Data Isolation...');
    // Run analysis for Bob (Python repo)
    const bobRunRes = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert(bobRunRes.status === 200, 'Bob analysis run returns 200 OK');

    const bobSkillsRes = await request('/api/skills', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const bobSkillsList = bobSkillsRes.data?.data || [];
    assert(bobSkillsList.some((s) => s.skillName === 'Python'), 'Bob skills list contains Python');
    assert(!bobSkillsList.some((s) => s.skillName === 'Java'), 'Bob skills list strictly does NOT contain Alice Java skill');
    assert(!bobSkillsList.some((s) => s.skillName === 'React'), 'Bob skills list strictly does NOT contain Alice React skill');

    // Check Alice cannot see Bob's Python
    const aliceReCheck = await request('/api/skills', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const aliceSkillsList = aliceReCheck.data?.data || [];
    assert(!aliceSkillsList.some((s) => s.skillName === 'Python'), 'Alice skills list strictly does NOT contain Bob Python skill');

    // Check cross-user direct evidence endpoint
    const bobJavaEvidence = await request('/api/skills/Java', {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    assert(bobJavaEvidence.status === 404, 'Bob requesting Alice Java evidence returns 404 (strictly isolated)');

    const alicePythonEvidence = await request('/api/skills/Python', {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(alicePythonEvidence.status === 404, 'Alice requesting Bob Python evidence returns 404 (strictly isolated)');

    // ─────────────────────────────────────────────────────────────
    // 9. Upstream Rate Limit Handling (429)
    // ─────────────────────────────────────────────────────────────
    console.log('\n[9/10] Testing Upstream Rate Limit Handling...');
    mockScenario = 'RATE_LIMITED';

    const rateLimitedRun = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(rateLimitedRun.status === 429, 'Rate limit encountered returns 429 Too Many Requests');
    assert(rateLimitedRun.data?.code === 'GITHUB_RATE_LIMITED', 'Error code is GITHUB_RATE_LIMITED');
    assert(rateLimitedRun.data?.message?.includes('rate limit'), 'User-friendly rate limit message returned');

    mockScenario = 'NORMAL';

    // ─────────────────────────────────────────────────────────────
    // 10. Database Transaction Safety on Mid-Repository Error
    // ─────────────────────────────────────────────────────────────
    console.log('\n[10/10] Testing Transaction Safety on DB Failure...');
    // Verify that if a repository cannot be analyzed due to non-rate-limit fetch error,
    // the system logs failure, skips it, and continues remaining repositories.
    // We test this by creating a broken repository with an invalid name
    const [brokenRepo] = await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [aliceId, 8889, 'missing-repo', 'alice/non-existent-repository-404', 'Missing repo', 'JavaScript', 'https://github.com/alice/missing-repo']
    );

    const runWithBrokenRepo = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    assert(runWithBrokenRepo.status === 200, 'Analysis with one failing repo still returns 200 OK');
    assert(runWithBrokenRepo.data?.data?.totalRepositories === 3, 'totalRepositories is 3');
    assert(runWithBrokenRepo.data?.data?.analyzedCount === 2, 'analyzedCount is 2 (2 succeeded)');
    assert(runWithBrokenRepo.data?.data?.skippedCount === 1, 'skippedCount is 1 (1 failed/skipped)');
    assert(Array.isArray(runWithBrokenRepo.data?.data?.failures), 'failures is returned as an array');
    assert(runWithBrokenRepo.data?.data?.failures?.length === 1, 'failures array contains the skipped repo');

    // Clean up broken repo
    await pool.query('DELETE FROM repositories WHERE id = ?', [brokenRepo.insertId]);

  } catch (err) {
    console.error('Unhandled Test Runner Error:', err);
    failed++;
  } finally {
    // Cleanup
    console.log('\n[Cleanup] Cleaning up test data from MySQL database...');
    try {
      if (aliceId) {
        await pool.query('DELETE FROM users WHERE id = ?', [aliceId]);
      }
      if (bobId) {
        await pool.query('DELETE FROM users WHERE id = ?', [bobId]);
      }
      if (charlieId) {
        await pool.query('DELETE FROM users WHERE id = ?', [charlieId]);
      }
    } catch (cleanErr) {
      console.error('Cleanup Error:', cleanErr.message);
    }

    if (server) {
      server.close();
    }

    console.log('====================================================');
    console.log(`📊 Phase 1B Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runSkillPersistenceTests();
