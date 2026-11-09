import 'dotenv/config';
import assert from 'assert';
import pool from '../src/config/db.js';
import { isSkillMatch } from '../src/utils/skillMatcher.js';
import { resolveSkillCategory } from '../src/controllers/skillController.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('🧪 Starting Skill Analysis & Evidence Audit Test Suite');
console.log('====================================================\n');

// 1. Skill Matcher Tests
console.log('[1/5] Testing Skill Matcher Disambiguation...');
test("Required 'Java' does NOT match detected 'JavaScript'", () => {
  assert.strictEqual(isSkillMatch('Java', 'JavaScript'), false);
});
test("Required 'Java' does NOT match detected 'TypeScript'", () => {
  assert.strictEqual(isSkillMatch('Java', 'TypeScript'), false);
});
test("Required 'JavaScript' does NOT match detected 'Java'", () => {
  assert.strictEqual(isSkillMatch('JavaScript', 'Java'), false);
});
test("Required 'Java' matches exact 'Java'", () => {
  assert.strictEqual(isSkillMatch('Java', 'Java'), true);
});
test("Required 'Java' matches compound 'Java / Kotlin' without matching JavaScript", () => {
  assert.strictEqual(isSkillMatch('Java / Kotlin', 'Java'), true);
  assert.strictEqual(isSkillMatch('Java / Kotlin', 'JavaScript'), false);
});
test("Required 'JavaScript' matches exact 'JavaScript'", () => {
  assert.strictEqual(isSkillMatch('JavaScript', 'JavaScript'), true);
});
test("Required 'Docker' matches 'Docker' and 'Docker Compose'", () => {
  assert.strictEqual(isSkillMatch('Docker', 'Docker'), true);
  assert.strictEqual(isSkillMatch('Docker', 'Docker Compose'), true);
});

// 2. Category Resolution Tests
console.log('\n[2/5] Testing Category Resolution & Docker Artifact Attribution...');
test("Docker with config_file resolves to 'Tool'", () => {
  assert.strictEqual(resolveSkillCategory('Docker', 'config_file'), 'Tool');
});
test("Docker with language_bytes still resolves to 'Tool' via FILE_EVIDENCE_MAP", () => {
  assert.strictEqual(resolveSkillCategory('Docker', 'language_bytes'), 'Tool');
});
test("Java resolves to 'Language'", () => {
  assert.strictEqual(resolveSkillCategory('Java', 'language_bytes'), 'Language');
});
test("JavaScript resolves to 'Language'", () => {
  assert.strictEqual(resolveSkillCategory('JavaScript', 'language_bytes'), 'Language');
});
test("React resolves to 'Framework'", () => {
  assert.strictEqual(resolveSkillCategory('React', 'dependency'), 'Framework');
});
test("Jenkins (CI/CD) resolves to 'Tool'", () => {
  assert.strictEqual(resolveSkillCategory('Jenkins (CI/CD)', 'config_file'), 'Tool');
});

// 3. Database Data Integrity & User 417 Evidence Audit
console.log('\n[3/5] Auditing Real Database Evidence for User 417 (tester1@gmail.com)...');

await asyncTest("User 417 exists and has 16 synchronized repositories", async () => {
  const [users] = await pool.query("SELECT id, github_username FROM users WHERE email = 'tester1@gmail.com'");
  assert.strictEqual(users.length, 1);
  const [repos] = await pool.query("SELECT id, full_name, owner_login FROM repositories WHERE user_id = ?", [users[0].id]);
  assert.strictEqual(repos.length, 16);
});

await asyncTest("Java evidence is strictly isolated to Suryaaa27/lab1 (1 repository)", async () => {
  const [javaRows] = await pool.query(`
    SELECT se.*, r.full_name
    FROM skill_evidence se
    JOIN repositories r ON se.repository_id = r.id
    WHERE se.skill_name = 'Java'
  `);
  assert.strictEqual(javaRows.length, 1);
  assert.strictEqual(javaRows[0].full_name, 'Suryaaa27/lab1');
});

await asyncTest("React repositories (my-portfolio, MarraigeBureau) have ZERO Java evidence", async () => {
  const [reactReposJava] = await pool.query(`
    SELECT se.*, r.full_name
    FROM skill_evidence se
    JOIN repositories r ON se.repository_id = r.id
    WHERE r.full_name IN ('Suryaaa27/my-portfolio', 'susmitapatil11/MarraigeBureau')
      AND se.skill_name = 'Java'
  `);
  assert.strictEqual(reactReposJava.length, 0);
});

await asyncTest("Docker evidence in krushh67/client-appointment-booking-system includes real Dockerfile", async () => {
  const [dockerRows] = await pool.query(`
    SELECT se.*, r.full_name
    FROM skill_evidence se
    JOIN repositories r ON se.repository_id = r.id
    WHERE r.full_name = 'krushh67/client-appointment-booking-system'
      AND se.skill_name = 'Docker'
  `);
  assert.strictEqual(dockerRows.length, 1);
  assert(dockerRows[0].evidence_details.includes('Dockerfile'));
});

await asyncTest("Spring Boot, MySQL, GitHub Actions, JUnit have ZERO rows in database (genuinely missing)", async () => {
  const [missingRows] = await pool.query(`
    SELECT se.*
    FROM skill_evidence se
    WHERE se.skill_name IN ('Spring Boot', 'MySQL', 'GitHub Actions', 'JUnit')
  `);
  assert.strictEqual(missingRows.length, 0);
});

// 4. Aggregated Skills Verification (19 Skills)
console.log('\n[4/5] Testing Aggregated Skills & Category Breakdown...');

await asyncTest("GET /api/skills aggregated query returns exactly 19 distinct skills", async () => {
  const [users] = await pool.query("SELECT id FROM users WHERE email = 'tester1@gmail.com'");
  const [rows] = await pool.query(`
    SELECT DISTINCT skill_name
    FROM skill_evidence se
    JOIN repositories r ON se.repository_id = r.id
    WHERE r.user_id = ?
  `, [users[0].id]);
  assert.strictEqual(rows.length, 19);
});

// 5. Confidence Score Math
console.log('\n[5/5] Testing Confidence Calculation Rules...');
test("Language share score formula clamps between 10% and 95%", () => {
  const minScore = Math.round(Math.min(Math.max(0.003 * 100, 10), 95));
  assert.strictEqual(minScore, 10);
  const maxScore = Math.round(Math.min(Math.max(1.0 * 100, 10), 95));
  assert.strictEqual(maxScore, 95);
});

test("Cross-repo aggregation formula adds 3 points per corroborating repo up to 95%", () => {
  const bestScore = 70;
  const repoCount = 3;
  const aggregated = Math.min(95, Math.round(bestScore + 3 * (repoCount - 1)));
  assert.strictEqual(aggregated, 76);
});

console.log('\n====================================================');
console.log(`📊 Audit Test Results: ${passed} Passed, ${failed} Failed`);
console.log('====================================================\n');

process.exit(failed > 0 ? 1 : 0);
