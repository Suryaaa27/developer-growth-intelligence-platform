import 'dotenv/config';
import app from '../src/app.js';
import pool from '../src/config/db.js';
import bcrypt from 'bcryptjs';

/**
 * Automated Test Suite: Repository Ownership, Collaborator Filtering & Stale Record Pruning
 *
 * Verifies:
 * 1. Default My Repositories view and main count strictly include repositories owned by the connected user.
 * 2. Collaborator-owned repositories (friend's repos, organization repos) are separated into Collaborations.
 * 3. Actual owners are clearly identified on every repository record (ownerLogin, isOwner).
 * 4. Stale records from previous tests (e.g. friend's repository previously synced) are pruned during synchronization.
 * 5. Backend filters by owner matching verified GitHub username (not relying on repo name).
 * 6. Query parameters ?type=owned, ?type=collaborations, ?type=all behave correctly.
 * 7. Per-user data isolation is strictly preserved.
 */

const TEST_PORT = 5098;
let server;
const baseUrl = `http://localhost:${TEST_PORT}`;

const timestamp = Date.now();
const testUserAlice = {
  name: 'Dev Alice Ownership',
  email: `alice.owner.${timestamp}@example.com`,
  password: 'Password123!',
  githubUsername: 'alice-dev',
  githubId: 987654321,
};

const testUserBob = {
  name: 'Dev Bob Ownership',
  email: `bob.owner.${timestamp}@example.com`,
  password: 'Password123!',
  githubUsername: 'bob-dev',
  githubId: 987654322,
};

let aliceToken = null;
let aliceId = null;
let bobToken = null;
let bobId = null;

let passed = 0;
let failed = 0;

const assert = (condition, testName) => {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
};

const originalFetch = globalThis.fetch;

// Mock GitHub API responses
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);

  if (urlStr.includes('api.github.com/users/alice-dev/repos')) {
    // Alice owns 2 repositories
    return new Response(
      JSON.stringify([
        {
          id: 2001,
          name: 'alice-personal-app',
          full_name: 'alice-dev/alice-personal-app',
          description: 'Personal application developed by Alice',
          language: 'JavaScript',
          html_url: 'https://github.com/alice-dev/alice-personal-app',
          private: false,
          fork: false,
          owner: { login: 'alice-dev', id: 987654321 },
          updated_at: '2026-10-20T12:00:00Z',
        },
        {
          id: 2002,
          name: 'shared-fork',
          full_name: 'alice-dev/shared-fork',
          description: 'A personal fork of an open-source library',
          language: 'TypeScript',
          html_url: 'https://github.com/alice-dev/shared-fork',
          private: false,
          fork: true,
          owner: { login: 'alice-dev', id: 987654321 },
          updated_at: '2026-10-22T14:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (urlStr.includes('api.github.com/users/bob-dev/repos')) {
    // Bob owns 1 repository
    return new Response(
      JSON.stringify([
        {
          id: 3001,
          name: 'bob-backend',
          full_name: 'bob-dev/bob-backend',
          description: 'Backend service by Bob',
          language: 'Python',
          html_url: 'https://github.com/bob-dev/bob-backend',
          private: false,
          fork: false,
          owner: { login: 'bob-dev', id: 987654322 },
          updated_at: '2026-10-23T10:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Collaborations endpoint
  if (urlStr.includes('affiliation=collaborator')) {
    // User is a collaborator on friend's repo and an organization repo
    return new Response(
      JSON.stringify([
        {
          id: 4001,
          name: 'team-dashboard',
          full_name: 'acme-org/team-dashboard',
          description: 'Company team dashboard',
          language: 'TypeScript',
          html_url: 'https://github.com/acme-org/team-dashboard',
          private: false,
          fork: false,
          owner: { login: 'acme-org', id: 55555 },
          updated_at: '2026-10-25T11:00:00Z',
        },
        {
          id: 4002,
          name: 'collab-library',
          full_name: 'friend-dev/collab-library',
          description: 'Open collaboration utility library',
          language: 'Go',
          html_url: 'https://github.com/friend-dev/collab-library',
          private: false,
          fork: false,
          owner: { login: 'friend-dev', id: 66666 },
          updated_at: '2026-10-26T15:00:00Z',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return originalFetch(url, options);
};

const runOwnershipTests = async () => {
  console.log('====================================================');
  console.log('🧪 Repository Ownership & Filtering Automated Test Suite');
  console.log('====================================================\n');

  try {
    // 0. Setup test server and accounts
    console.log('[Setup] Starting test server and provisioning verified accounts...');
    server = app.listen(TEST_PORT);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Password123!', salt);

    // Create Alice (with verified githubUsername: 'alice_dev')
    const [resAlice] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username)
       VALUES (?, ?, ?, 'USER', TRUE, ?, ?)`,
      [testUserAlice.name, testUserAlice.email, passwordHash, testUserAlice.githubId, testUserAlice.githubUsername]
    );
    aliceId = resAlice.insertId;

    // Create Bob (with verified githubUsername: 'bob_dev')
    const [resBob] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, github_id, github_username)
       VALUES (?, ?, ?, 'USER', TRUE, ?, ?)`,
      [testUserBob.name, testUserBob.email, passwordHash, testUserBob.githubId, testUserBob.githubUsername]
    );
    bobId = resBob.insertId;

    // Login Alice
    const loginAliceRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserAlice.email, password: testUserAlice.password }),
    });
    const loginAliceData = await loginAliceRes.json();
    aliceToken = loginAliceData.data?.token;

    // Login Bob
    const loginBobRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUserBob.email, password: testUserBob.password }),
    });
    const loginBobData = await loginBobRes.json();
    bobToken = loginBobData.data?.token;

    console.log(`Setup complete. Alice ID: ${aliceId}, Bob ID: ${bobId}\n`);

    // ── Test 1: Syncing Verified Repositories ──────────────────────────────────
    console.log('[1/5] Testing Sync and Ownership Classification...');
    const syncRes = await fetch(`${baseUrl}/api/github/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ githubUsername: 'alice-dev' }),
    });
    const syncData = await syncRes.json();
    if (syncRes.status !== 200) {
      console.error('syncRes failed with status:', syncRes.status, syncData);
    }

    assert(syncRes.status === 200, 'Sync returns 200 OK for verified user');
    assert(syncData.data.count === 2, 'Main count reflects only 2 owned repositories');
    assert(syncData.data.ownedCount === 2, 'ownedCount strictly equals 2');
    assert(syncData.data.repositories.length === 2, 'Default repositories array contains 2 owned items');
    assert(
      syncData.data.repositories.every((r) => r.isOwner === true),
      'All items in repositories array have isOwner === true'
    );
    assert(
      syncData.data.repositories.every((r) => r.ownerLogin.toLowerCase() === 'alice-dev'),
      'All items in repositories array have ownerLogin === alice-dev'
    );

    // ── Test 2: GET /api/github/repos Default My Repositories View ────────────
    console.log('\n[2/5] Testing GET /api/github/repos Default View...');
    const getRes = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getData = await getRes.json();

    assert(getRes.status === 200, 'GET /api/github/repos returns 200 OK');
    assert(getData.data.count === 2, 'Default count reflects only 2 owned repositories');
    assert(getData.data.repositories.length === 2, 'Default list contains only owned repositories');
    assert(
      getData.data.repositories.some((r) => r.repoName === 'alice-personal-app'),
      'Owned personal app is present in default list'
    );
    assert(
      getData.data.repositories.some((r) => r.repoName === 'shared-fork' && r.isFork === true),
      'Owned fork is present and marked with isFork: true'
    );

    // ── Test 3: Simulating and Filtering Out Stale / Friend's Repositories ────
    console.log('\n[3/5] Testing Stale Friend Repository Infiltration & Pruning...');

    // Manually insert a stale record for Alice (simulating a friend's repo like Mrunal-Chatbot previously synced)
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, owner_login, primary_language, html_url, updated_at)
       VALUES (?, 88888, 'mrunal-chatbot', 'vsutar1010/mrunal-chatbot', 'vsutar1010', 'Python', 'https://github.com/vsutar1010/mrunal-chatbot', NOW())`,
      [aliceId]
    );

    // Manually insert an unrelated test repo (e.g. octocat)
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, owner_login, primary_language, html_url, updated_at)
       VALUES (?, 99999, 'octo-demo', 'octocat/octo-demo', 'octocat', 'HTML', 'https://github.com/octocat/octo-demo', NOW())`,
      [aliceId]
    );

    // Verify GET /api/github/repos still DOES NOT include them in default owned list
    const getWithStaleRes = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getWithStaleData = await getWithStaleRes.json();

    assert(
      getWithStaleData.data.count === 2,
      'Default count still strictly excludes friend and octocat repositories'
    );
    assert(
      !getWithStaleData.data.repositories.some((r) => r.repoName === 'mrunal-chatbot'),
      'Friend repository (mrunal-chatbot) is strictly excluded from My Repositories'
    );
    assert(
      !getWithStaleData.data.repositories.some((r) => r.repoName === 'octo-demo'),
      'Test repository (octo-demo) is strictly excluded from My Repositories'
    );

    // Re-sync Alice — must automatically prune stale records from DB
    console.log('\n[4/5] Testing Automatic Stale Record Pruning on Re-sync...');
    const reSyncRes = await fetch(`${baseUrl}/api/github/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aliceToken}`,
      },
      body: JSON.stringify({ githubUsername: 'alice-dev' }),
    });
    assert(reSyncRes.status === 200, 'Re-sync returns 200 OK');

    const [aliceDbAfterSync] = await pool.query(
      'SELECT full_name, owner_login FROM repositories WHERE user_id = ?',
      [aliceId]
    );
    assert(
      aliceDbAfterSync.length === 2,
      'Stale friend and test repositories were pruned from MySQL (exactly 2 rows remain)'
    );
    assert(
      !aliceDbAfterSync.some((r) => r.full_name.includes('vsutar1010') || r.full_name.includes('octocat')),
      'No friend or octocat repositories remain in database for Alice'
    );

    // ── Test 5: Collaborator & Organization Repositories (Separation & Queries)
    console.log('\n[5/6] Testing Collaborations & Organization Repositories...');

    // Insert 1 friend collaboration repository and 1 organization repository for Alice
    await pool.query(
      `INSERT INTO repositories (user_id, github_repo_id, repo_name, full_name, owner_login, primary_language, html_url, updated_at)
       VALUES (?, 7001, 'friend-collab-tool', 'friend-dev/friend-collab-tool', 'friend-dev', 'Go', 'https://github.com/friend-dev/friend-collab-tool', NOW()),
              (?, 7002, 'org-enterprise-app', 'acme-corp/org-enterprise-app', 'acme-corp', 'Kotlin', 'https://github.com/acme-corp/org-enterprise-app', NOW())`,
      [aliceId, aliceId]
    );

    // Test default query: still returns strictly 2 owned repositories
    const getOwnedRes = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getOwnedData = await getOwnedRes.json();
    assert(getOwnedData.data.count === 2, 'Default view count remains 2 (owned only)');
    assert(getOwnedData.data.ownedCount === 2, 'ownedCount property is 2');
    assert(getOwnedData.data.collaborationCount === 2, 'collaborationCount property is 2');
    assert(getOwnedData.data.collaborations.length === 2, 'collaborations array has 2 items');
    assert(
      getOwnedData.data.collaborations.some((r) => r.ownerLogin === 'friend-dev' && r.isOwner === false),
      'Friend collaborator repo has isOwner: false and ownerLogin: friend-dev'
    );
    assert(
      getOwnedData.data.collaborations.some((r) => r.ownerLogin === 'acme-corp' && r.isOwner === false),
      'Organization repo has isOwner: false and ownerLogin: acme-corp'
    );

    // Test ?type=collaborations
    const getCollabOnlyRes = await fetch(`${baseUrl}/api/github/repos?type=collaborations`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getCollabOnlyData = await getCollabOnlyRes.json();
    assert(getCollabOnlyData.data.count === 2, '?type=collaborations count is 2');
    assert(getCollabOnlyData.data.repositories.length === 2, '?type=collaborations returns only collaboration repos');
    assert(
      getCollabOnlyData.data.repositories.every((r) => r.isOwner === false),
      '?type=collaborations items all have isOwner === false'
    );

    // Test ?type=all
    const getAllRes = await fetch(`${baseUrl}/api/github/repos?type=all`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getAllData = await getAllRes.json();
    assert(getAllData.data.count === 4, '?type=all count is 4 (2 owned + 2 collaborations)');
    assert(getAllData.data.repositories.length === 4, '?type=all returns all 4 repositories');

    // ── Test 6: User Isolation and Cross-User Protection ───────────────────────
    console.log('\n[6/6] Testing User Isolation (Alice vs Bob)...');
    const syncBobRes = await fetch(`${baseUrl}/api/github/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bobToken}`,
      },
      body: JSON.stringify({ githubUsername: 'bob-dev' }),
    });
    assert(syncBobRes.status === 200, 'Bob sync returns 200 OK');

    const getBobRes = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    });
    const getBobData = await getBobRes.json();

    assert(getBobData.data.count === 1, 'Bob has exactly 1 owned repository');
    assert(getBobData.data.repositories[0].repoName === 'bob-backend', 'Bob sees only his own repository');
    assert(
      !getBobData.data.repositories.some((r) => r.ownerLogin === 'alice-dev'),
      'Bob strictly cannot see Alice repositories'
    );

    // Confirm Alice is unchanged
    const getAliceFinalRes = await fetch(`${baseUrl}/api/github/repos`, {
      headers: { Authorization: `Bearer ${aliceToken}` },
    });
    const getAliceFinalData = await getAliceFinalRes.json();
    assert(getAliceFinalData.data.count === 2, 'Alice count is completely unaffected by Bob actions');

  } catch (err) {
    console.error('Unhandled test exception:', err);
    failed++;
  } finally {
    console.log('\n🧹 Cleaning up test accounts from database...');
    try {
      if (aliceId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [aliceId]);
        await pool.query('DELETE FROM users WHERE id = ?', [aliceId]);
      }
      if (bobId) {
        await pool.query('DELETE FROM repositories WHERE user_id = ?', [bobId]);
        await pool.query('DELETE FROM users WHERE id = ?', [bobId]);
      }
    } catch (_) {}

    if (server) server.close();
    globalThis.fetch = originalFetch;

    console.log('\n====================================================');
    console.log(`📊 Ownership & Filtering Results: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
};

runOwnershipTests();
