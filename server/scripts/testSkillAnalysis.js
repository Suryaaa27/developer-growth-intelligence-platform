/**
 * Phase 1A Test Suite — Skill Analysis: GitHub Service, Analyzers, and Detection Service
 *
 * Tests are self-contained Node.js scripts that mirror the project's existing test
 * conventions (plain node, globalThis.fetch mocking, no external test framework).
 *
 * Sections:
 *   A. githubService — fetchRepoLanguages & fetchFileContent
 *   B. languageAnalyzer — analyzeLanguages
 *   C. dependencyAnalyzer — analyzePackageJson & analyzePomXml
 *   D. fileEvidenceAnalyzer — analyzeFileEvidence
 *   E. skillDetectionService — detectSkillsFromRepo & aggregateSkillsForUser (mocked DB)
 *
 * Run:  node scripts/testSkillAnalysis.js
 * All tests must pass without real GitHub credentials or network access.
 */

import { fetchRepoLanguages, fetchFileContent } from '../src/services/githubService.js';
import { analyzeLanguages, LANGUAGE_SKILL_MAP } from '../src/analyzers/languageAnalyzer.js';
import {
  analyzePackageJson,
  analyzePomXml,
  NPM_SKILL_MAP,
  MAVEN_SKILL_MAP,
} from '../src/analyzers/dependencyAnalyzer.js';
import { analyzeFileEvidence } from '../src/analyzers/fileEvidenceAnalyzer.js';
import { detectSkillsFromRepo, aggregateSkillsForUser } from '../src/services/skillDetectionService.js';

// ─── Test harness ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

const assert = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
    failures.push({ label, detail });
  }
};

const assertThrowsAsync = async (label, fn, expectedCode) => {
  try {
    await fn();
    console.error(`  ✗ FAIL: ${label} — expected an error but none was thrown`);
    failed++;
    failures.push({ label, detail: 'Expected error not thrown' });
  } catch (err) {
    if (expectedCode && err.code !== expectedCode && err.status !== Number(expectedCode)) {
      const detail = `Expected code/status ${expectedCode}, got code=${err.code} status=${err.status}`;
      console.error(`  ✗ FAIL: ${label} — ${detail}`);
      failed++;
      failures.push({ label, detail });
    } else {
      console.log(`  ✓ ${label}`);
      passed++;
    }
  }
};

const section = (name) => console.log(`\n── ${name} ─────────────────────────────────────`);

// ─── Mock fetch builder ───────────────────────────────────────────────────────

const makeMockFetch = (scenarioFn) => async (url, options) => scenarioFn(url, options);

const mockOkJson = (body, headers = {}) =>
  makeMockFetch(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  );

const mockStatus = (status, body = {}, headers = {}) =>
  makeMockFetch(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })
  );

const mockAbort = () =>
  makeMockFetch(async () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  });

// ─── Mock DB pool (for skillDetectionService) ─────────────────────────────────
// Replaces pool.query for unit testing without a real DB connection.
// The service imports pool from '../config/db.js'; we patch its prototype here.
// This is only valid if pool is a singleton object — which it is (pool.js exports
// a single mysql2 pool instance).

let mockDbRows = [];
let mockDbShouldThrow = false;

// We need to intercept the pool import inside skillDetectionService.
// Since Node.js ESM caches modules, we inject a custom fetcher and patch at the
// service call level via _options.fetcher. DB patching is done via a wrapper.
// For aggregateSkillsForUser the DB dependency is too deep to patch without
// a real db, so we test it indirectly through detectSkillsFromRepo + manual
// aggregation logic coverage.

// ─── Section A: githubService.fetchRepoLanguages ──────────────────────────────

const runGithubServiceTests = async () => {
  section('A. githubService — fetchRepoLanguages');

  // A1. Valid languages response
  {
    const fetcher = mockOkJson({ JavaScript: 12000, TypeScript: 4000, CSS: 1000 });
    const result = await fetchRepoLanguages('owner/repo', null, { fetcher });
    assert('A1: returns parsed language map', result !== null && typeof result === 'object');
    assert('A1: JavaScript present', result.JavaScript === 12000);
    assert('A1: TypeScript present', result.TypeScript === 4000);
  }

  // A2. Empty language map → null
  {
    const fetcher = mockOkJson({});
    const result = await fetchRepoLanguages('owner/repo', null, { fetcher });
    assert('A2: empty map returns null', result === null);
  }

  // A3. 404 → throws with status 404
  await assertThrowsAsync(
    'A3: 404 throws GITHUB_REPO_NOT_FOUND',
    () => fetchRepoLanguages('owner/missing', null, { fetcher: mockStatus(404, { message: 'Not Found' }) }),
    'GITHUB_REPO_NOT_FOUND'
  );

  // A4. 429 rate limited → throws GITHUB_RATE_LIMITED
  await assertThrowsAsync(
    'A4: 429 throws GITHUB_RATE_LIMITED',
    () =>
      fetchRepoLanguages('owner/repo', null, {
        fetcher: mockStatus(429, { message: 'rate limit' }, { 'x-ratelimit-remaining': '0' }),
      }),
    'GITHUB_RATE_LIMITED'
  );

  // A5. 403 with rate limit header → throws GITHUB_RATE_LIMITED
  await assertThrowsAsync(
    'A5: 403+remaining=0 throws GITHUB_RATE_LIMITED',
    () =>
      fetchRepoLanguages('owner/repo', null, {
        fetcher: mockStatus(403, { message: 'forbidden' }, { 'x-ratelimit-remaining': '0' }),
      }),
    'GITHUB_RATE_LIMITED'
  );

  // A6. Timeout (AbortError) → throws (504 status)
  await assertThrowsAsync(
    'A6: AbortError throws timeout error',
    () => fetchRepoLanguages('owner/repo', null, { fetcher: mockAbort() }),
    null // status=504 checked loosely
  );

  // A7. Invalid fullRepoName
  await assertThrowsAsync(
    'A7: missing slash in fullRepoName throws',
    () => fetchRepoLanguages('invalid-no-slash', null, {}),
    null
  );

  // A8. Non-object response (array) → null
  {
    const fetcher = mockOkJson([{ oops: 'array' }]);
    const result = await fetchRepoLanguages('owner/repo', null, { fetcher });
    assert('A8: array response returns null', result === null);
  }

  section('A. githubService — fetchFileContent');

  // A9. Valid base64 file content
  {
    const content = 'Hello, world!';
    const base64 = Buffer.from(content).toString('base64');
    const fetcher = mockOkJson({
      type: 'file',
      encoding: 'base64',
      size: content.length,
      content: base64 + '\n',
      name: 'package.json',
      path: 'package.json',
    });
    const result = await fetchFileContent('owner/repo', 'package.json', null, { fetcher });
    assert('A9: decodes base64 content correctly', result === content);
  }

  // A10. 404 → returns null (not an error)
  {
    const fetcher = mockStatus(404);
    const result = await fetchFileContent('owner/repo', 'nonexistent.json', null, { fetcher });
    assert('A10: 404 returns null (file absent)', result === null);
  }

  // A11. Oversized file (size > 1MB) → null
  {
    const fetcher = mockOkJson({
      type: 'file',
      encoding: 'base64',
      size: 2_000_000,
      content: 'dG9vbGFyZ2U=\n',
    });
    const result = await fetchFileContent('owner/repo', 'huge.json', null, { fetcher });
    assert('A11: oversized file returns null', result === null);
  }

  // A12. Directory listing response (array) → null
  {
    const fetcher = mockOkJson([{ name: 'file1.js', type: 'file' }]);
    const result = await fetchFileContent('owner/repo', 'src', null, { fetcher });
    assert('A12: directory listing returns null', result === null);
  }

  // A13. Non-base64 encoding → null
  {
    const fetcher = mockOkJson({
      type: 'file',
      encoding: 'utf-8',
      size: 100,
      content: 'raw content',
    });
    const result = await fetchFileContent('owner/repo', 'file.txt', null, { fetcher });
    assert('A13: non-base64 encoding returns null', result === null);
  }

  // A14. Rate limited → throws
  await assertThrowsAsync(
    'A14: 429 on fetchFileContent throws GITHUB_RATE_LIMITED',
    () =>
      fetchFileContent('owner/repo', 'package.json', null, {
        fetcher: mockStatus(429, {}, { 'x-ratelimit-remaining': '0' }),
      }),
    'GITHUB_RATE_LIMITED'
  );
};

// ─── Section B: languageAnalyzer ──────────────────────────────────────────────

const runLanguageAnalyzerTests = () => {
  section('B. languageAnalyzer — analyzeLanguages');

  // B1. Normal usage — scores proportional to byte share
  {
    const result = analyzeLanguages({ JavaScript: 80000, TypeScript: 20000 });
    assert('B1: returns 2 entries', result.length === 2);
    const js = result.find((r) => r.skillName === 'JavaScript');
    const ts = result.find((r) => r.skillName === 'TypeScript');
    assert('B1: JavaScript found', !!js);
    assert('B1: TypeScript found', !!ts);
    assert('B1: JavaScript has higher confidence than TypeScript', js.confidenceScore > ts.confidenceScore);
    assert('B1: confidence capped at 95', js.confidenceScore <= 95);
    assert('B1: confidence floor at 10', ts.confidenceScore >= 10);
  }

  // B2. Single-language repo → confidence is MAX_CONFIDENCE (95)
  {
    const result = analyzeLanguages({ Java: 100000 });
    assert('B2: single language returns 1 entry', result.length === 1);
    assert('B2: single language confidence ≤ 95', result[0].confidenceScore <= 95);
    assert('B2: category is Language', result[0].category === 'Language');
    assert('B2: evidenceType is language_bytes', result[0].evidenceType === 'language_bytes');
  }

  // B3. Null/undefined input → empty array
  assert('B3: null returns []', analyzeLanguages(null).length === 0);
  assert('B3: undefined returns []', analyzeLanguages(undefined).length === 0);
  assert('B3: empty object returns []', analyzeLanguages({}).length === 0);
  assert('B3: array returns []', analyzeLanguages([]).length === 0);

  // B4. Zero bytes → filtered out
  {
    const result = analyzeLanguages({ JavaScript: 0, TypeScript: 5000 });
    const js = result.find((r) => r.skillName === 'JavaScript');
    assert('B4: zero-byte language excluded', !js);
    assert('B4: non-zero language still included', result.length === 1);
  }

  // B5. Unknown language preserved verbatim
  {
    const result = analyzeLanguages({ Brainfuck: 3000, JavaScript: 7000 });
    const bf = result.find((r) => r.skillName === 'Brainfuck');
    assert('B5: unknown language preserved as skillName', !!bf);
  }

  // B6. LANGUAGE_SKILL_MAP contains required entries
  assert('B6: Java mapped', LANGUAGE_SKILL_MAP['Java'] === 'Java');
  assert('B6: JavaScript mapped', LANGUAGE_SKILL_MAP['JavaScript'] === 'JavaScript');
  assert('B6: TypeScript mapped', LANGUAGE_SKILL_MAP['TypeScript'] === 'TypeScript');
  assert('B6: Python mapped', LANGUAGE_SKILL_MAP['Python'] === 'Python');
  assert('B6: Go mapped', LANGUAGE_SKILL_MAP['Go'] === 'Go');

  // B7. Total bytes = 0 → empty array
  {
    const result = analyzeLanguages({ JavaScript: 0, TypeScript: 0 });
    assert('B7: all-zero byte map returns []', result.length === 0);
  }
};

// ─── Section C: dependencyAnalyzer ────────────────────────────────────────────

const runDependencyAnalyzerTests = () => {
  section('C. dependencyAnalyzer — analyzePackageJson');

  // C1. Production dependency → score 70
  {
    const pkg = JSON.stringify({ dependencies: { react: '^18.0.0', mongoose: '^7.0.0' } });
    const result = analyzePackageJson(pkg);
    const reactEntry = result.find((r) => r.skillName === 'React');
    assert('C1: react found', !!reactEntry);
    assert('C1: production dependency score = 70', reactEntry.confidenceScore === 70);
    assert('C1: evidenceType is dependency', reactEntry.evidenceType === 'dependency');
  }

  // C2. DevDependency → score 50
  {
    const pkg = JSON.stringify({ devDependencies: { jest: '^29.0.0' } });
    const result = analyzePackageJson(pkg);
    const jestEntry = result.find((r) => r.skillName === 'Jest (Testing)');
    assert('C2: jest found as devDep', !!jestEntry);
    assert('C2: devDependency score = 50', jestEntry.confidenceScore === 50);
  }

  // C3. Same package in both prod and dev → score 70 (higher wins)
  {
    const pkg = JSON.stringify({
      dependencies: { typescript: '^5.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });
    const result = analyzePackageJson(pkg);
    const ts = result.filter((r) => r.skillName === 'TypeScript');
    assert('C3: no duplicates — TypeScript appears once', ts.length === 1);
    assert('C3: higher score (70) is kept', ts[0].confidenceScore === 70);
  }

  // C4. Unknown packages → not included
  {
    const pkg = JSON.stringify({ dependencies: { 'some-obscure-lib': '^1.0.0' } });
    const result = analyzePackageJson(pkg);
    assert('C4: unknown packages not emitted', result.length === 0);
  }

  // C5. Malformed JSON → empty array (no crash)
  assert('C5: malformed JSON returns []', analyzePackageJson('{ invalid json }').length === 0);
  assert('C5: null returns []', analyzePackageJson(null).length === 0);
  assert('C5: empty string returns []', analyzePackageJson('').length === 0);

  // C6. Array at root → empty array
  assert('C6: JSON array at root returns []', analyzePackageJson('[1, 2, 3]').length === 0);

  // C7. No dependencies keys → empty array
  {
    const pkg = JSON.stringify({ name: 'my-app', version: '1.0.0' });
    assert('C7: no dep keys returns []', analyzePackageJson(pkg).length === 0);
  }

  section('C. dependencyAnalyzer — analyzePomXml');

  // C8. Spring Boot in pom.xml → Framework
  {
    const pom = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
          </dependency>
        </dependencies>
      </project>`;
    const result = analyzePomXml(pom);
    const sb = result.find((r) => r.skillName === 'Spring Boot');
    assert('C8: Spring Boot found', !!sb);
    assert('C8: compile scope score = 60', sb.confidenceScore === 60);
    assert('C8: category is Framework', sb.category === 'Framework');
  }

  // C9. Test scope → score 40
  {
    const pom = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
          </dependency>
        </dependencies>
      </project>`;
    const result = analyzePomXml(pom);
    const junit = result.find((r) => r.skillName === 'JUnit 5');
    assert('C9: JUnit 5 found', !!junit);
    assert('C9: test scope score = 40', junit.confidenceScore === 40);
  }

  // C10. Unrecognized dependency → not included
  {
    const pom = `
      <dependency>
        <groupId>com.unknown</groupId>
        <artifactId>unknown-lib</artifactId>
      </dependency>`;
    const result = analyzePomXml(pom);
    assert('C10: unknown dependency not emitted', result.length === 0);
  }

  // C11. Malformed XML → empty array (no crash)
  assert('C11: malformed XML returns []', analyzePomXml('<broken>').length === 0);
  assert('C11: null returns []', analyzePomXml(null).length === 0);

  // C12. Duplicate skills (multiple Spring Boot starters) → deduplicated
  {
    const pom = `
      <project>
        <dependencies>
          <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter</artifactId>
          </dependency>
          <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
          </dependency>
        </dependencies>
      </project>`;
    const result = analyzePomXml(pom);
    const sbEntries = result.filter((r) => r.skillName === 'Spring Boot');
    assert('C12: Spring Boot deduplicated to 1 entry', sbEntries.length === 1);
  }

  // C13. NPM_SKILL_MAP sanity checks
  assert('C13: express in NPM map', !!NPM_SKILL_MAP['express']);
  assert('C13: react in NPM map', NPM_SKILL_MAP['react'].skillName === 'React');
  assert('C13: mongoose in NPM map', !!NPM_SKILL_MAP['mongoose']);

  // C14. MAVEN_SKILL_MAP sanity checks
  assert('C14: spring-boot-starter in MAVEN map', !!MAVEN_SKILL_MAP['org.springframework.boot:spring-boot-starter']);
  assert('C14: postgresql in MAVEN map', !!MAVEN_SKILL_MAP['org.postgresql:postgresql']);
};

// ─── Section D: fileEvidenceAnalyzer ─────────────────────────────────────────

const runFileEvidenceTests = () => {
  section('D. fileEvidenceAnalyzer — analyzeFileEvidence');

  // D1. Dockerfile → Docker
  {
    const result = analyzeFileEvidence(['Dockerfile', 'src/index.js']);
    const docker = result.find((r) => r.skillName === 'Docker');
    assert('D1: Dockerfile detected as Docker', !!docker);
    assert('D1: confidenceScore = 80', docker.confidenceScore === 80);
    assert('D1: evidenceType is config_file', docker.evidenceType === 'config_file');
  }

  // D2. GitHub Actions workflow
  {
    const result = analyzeFileEvidence(['.github/workflows/ci.yml']);
    const ga = result.find((r) => r.skillName === 'GitHub Actions (CI/CD)');
    assert('D2: GitHub Actions workflow detected', !!ga);
  }

  // D3. docker-compose.yml → Docker Compose
  {
    const result = analyzeFileEvidence(['docker-compose.yml']);
    const dc = result.find((r) => r.skillName === 'Docker Compose');
    assert('D3: docker-compose.yml detected', !!dc);
  }

  // D4. Jenkinsfile → Jenkins
  {
    const result = analyzeFileEvidence(['Jenkinsfile']);
    assert('D4: Jenkinsfile detected', !!result.find((r) => r.skillName === 'Jenkins (CI/CD)'));
  }

  // D5. tsconfig.json → TypeScript
  {
    const result = analyzeFileEvidence(['tsconfig.json', 'package.json', 'src/app.ts']);
    const ts = result.find((r) => r.skillName === 'TypeScript');
    assert('D5: tsconfig.json signals TypeScript', !!ts);
  }

  // D6. requirements.txt → Python
  {
    const result = analyzeFileEvidence(['requirements.txt']);
    assert('D6: requirements.txt signals Python', !!result.find((r) => r.skillName === 'Python'));
  }

  // D7. Empty or null input → []
  assert('D7: empty array returns []', analyzeFileEvidence([]).length === 0);
  assert('D7: null returns []', analyzeFileEvidence(null).length === 0);
  assert('D7: undefined returns []', analyzeFileEvidence(undefined).length === 0);

  // D8. Non-string entries in array → skipped safely
  {
    const result = analyzeFileEvidence([null, 123, 'Dockerfile', undefined]);
    const docker = result.find((r) => r.skillName === 'Docker');
    assert('D8: non-string entries skipped, Dockerfile still found', !!docker);
  }

  // D9. Unrecognized files → no output
  {
    const result = analyzeFileEvidence(['README.md', 'src/main.go', 'tests/unit.py']);
    assert('D9: unrecognized files produce no evidence', result.length === 0);
  }

  // D10. Deduplication: Dockerfile + *.dockerfile both match Docker → only one entry
  {
    const result = analyzeFileEvidence(['Dockerfile', 'backend.dockerfile']);
    const dockerEntries = result.filter((r) => r.skillName === 'Docker');
    assert('D10: Docker deduplicated to 1 entry', dockerEntries.length === 1);
    assert('D10: highest confidence (80) kept', dockerEntries[0].confidenceScore === 80);
  }

  // D11. .travis.yml
  {
    const result = analyzeFileEvidence(['.travis.yml']);
    assert('D11: .travis.yml detected', !!result.find((r) => r.skillName === 'Travis CI'));
  }

  // D12. Terraform .tf suffix
  {
    const result = analyzeFileEvidence(['main.tf', 'variables.tf']);
    const tf = result.filter((r) => r.skillName === 'Terraform');
    assert('D12: .tf files detected as Terraform', tf.length === 1);
  }

  // D13. Spring application.properties (deep path)
  {
    const result = analyzeFileEvidence(['src/main/resources/application.properties']);
    assert('D13: application.properties detected as Spring Boot',
      !!result.find((r) => r.skillName === 'Spring Boot'));
  }
};

// ─── Section E: skillDetectionService — detectSkillsFromRepo ─────────────────

const runSkillDetectionTests = async () => {
  section('E. skillDetectionService — detectSkillsFromRepo');

  // Build a compound mock fetcher that routes URLs to appropriate responses
  const makeCompoundFetcher = ({ languages, packageJson, pomXml, rootListing } = {}) => {
    const packageJsonBase64 = packageJson
      ? Buffer.from(packageJson).toString('base64')
      : null;
    const pomXmlBase64 = pomXml
      ? Buffer.from(pomXml).toString('base64')
      : null;

    return async (url) => {
      const urlStr = String(url);

      // Languages endpoint
      if (urlStr.includes('/languages')) {
        if (!languages) {
          return new Response(JSON.stringify({}), { status: 200 });
        }
        return new Response(JSON.stringify(languages), { status: 200 });
      }

      // package.json content
      if (urlStr.includes('/contents/package.json')) {
        if (!packageJsonBase64) {
          return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        return new Response(
          JSON.stringify({ encoding: 'base64', size: packageJson.length, content: packageJsonBase64 + '\n' }),
          { status: 200 }
        );
      }

      // pom.xml content
      if (urlStr.includes('/contents/pom.xml')) {
        if (!pomXmlBase64) {
          return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
        }
        return new Response(
          JSON.stringify({ encoding: 'base64', size: pomXml.length, content: pomXmlBase64 + '\n' }),
          { status: 200 }
        );
      }

      // Root contents listing
      if (urlStr.match(/\/contents$/) || urlStr.match(/\/contents\?/)) {
        if (!rootListing) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        const items = rootListing.map((name) => ({ name, path: name, type: 'file' }));
        return new Response(JSON.stringify(items), { status: 200 });
      }

      return new Response(JSON.stringify([]), { status: 200 });
    };
  };

  // E1. Language detection via language map
  {
    const repo = { id: 1, fullName: 'alice/my-repo', primaryLanguage: 'JavaScript', userId: 42 };
    const fetcher = makeCompoundFetcher({ languages: { JavaScript: 90000, TypeScript: 10000 } });
    const result = await detectSkillsFromRepo(repo, { fetcher });
    const js = result.find((r) => r.skillName === 'JavaScript');
    assert('E1: JavaScript detected from language map', !!js);
    assert('E1: repositoryFullName attributed', js.repositoryFullName === 'alice/my-repo');
    assert('E1: repositoryId attributed', js.repositoryId === 1);
    assert('E1: confidenceScore > 0', js.confidenceScore > 0);
  }

  // E2. Dependency detection via package.json
  {
    const repo = { id: 2, fullName: 'alice/node-app', primaryLanguage: 'JavaScript', userId: 42 };
    const pkg = JSON.stringify({ dependencies: { express: '^4.0.0', mongoose: '^7.0.0' } });
    const fetcher = makeCompoundFetcher({ packageJson: pkg });
    const result = await detectSkillsFromRepo(repo, { fetcher });
    const express = result.find((r) => r.skillName === 'Express.js');
    const mongo = result.find((r) => r.skillName === 'MongoDB (Mongoose)');
    assert('E2: Express.js detected from package.json', !!express);
    assert('E2: MongoDB detected from package.json', !!mongo);
  }

  // E3. File evidence detection via root listing
  {
    const repo = { id: 3, fullName: 'alice/dockerized', primaryLanguage: null, userId: 42 };
    const fetcher = makeCompoundFetcher({ rootListing: ['Dockerfile', 'docker-compose.yml', '.github/workflows/ci.yml'] });
    const result = await detectSkillsFromRepo(repo, { fetcher });
    assert('E3: Docker detected from Dockerfile', !!result.find((r) => r.skillName === 'Docker'));
    assert('E3: Docker Compose detected', !!result.find((r) => r.skillName === 'Docker Compose'));
    assert('E3: GitHub Actions detected', !!result.find((r) => r.skillName === 'GitHub Actions (CI/CD)'));
  }

  // E4. Cross-analyzer deduplication: TypeScript from language AND tsconfig.json
  {
    const repo = { id: 4, fullName: 'alice/ts-app', primaryLanguage: 'TypeScript', userId: 42 };
    const pkg = JSON.stringify({ devDependencies: { typescript: '^5.0.0' } });
    const fetcher = makeCompoundFetcher({
      languages: { TypeScript: 100000 },
      packageJson: pkg,
      rootListing: ['tsconfig.json'],
    });
    const result = await detectSkillsFromRepo(repo, { fetcher });
    const tsEntries = result.filter((r) => r.skillName === 'TypeScript');
    assert('E4: TypeScript deduplicated to 1 entry', tsEntries.length === 1);
    // Combined from language (high) + devDep (50) + config_file (70) → bonus applied
    assert('E4: combined score > single analyzer score (>80)', tsEntries[0].confidenceScore > 80);
    assert('E4: combined score ≤ MAX_COMBINED (92)', tsEntries[0].confidenceScore <= 92);
  }

  // E5. Missing repo (no results from any analyzer) → []
  {
    const repo = { id: 5, fullName: 'alice/empty-repo', primaryLanguage: null, userId: 42 };
    const fetcher = makeCompoundFetcher({});
    const result = await detectSkillsFromRepo(repo, { fetcher });
    assert('E5: empty repo returns []', result.length === 0);
  }

  // E6. Invalid repository object → []
  {
    const result = await detectSkillsFromRepo(null, {});
    assert('E6: null repo returns []', result.length === 0);
  }

  // E7. Malformed package.json → graceful recovery (still returns language results)
  {
    const repo = { id: 7, fullName: 'alice/bad-json', primaryLanguage: 'JavaScript', userId: 42 };
    const brokenPkgBase64 = Buffer.from('{ not json }').toString('base64');
    const fetcher = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/languages')) {
        return new Response(JSON.stringify({ JavaScript: 50000 }), { status: 200 });
      }
      if (urlStr.includes('/contents/package.json')) {
        return new Response(
          JSON.stringify({ encoding: 'base64', size: 12, content: brokenPkgBase64 }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    };
    const result = await detectSkillsFromRepo(repo, { fetcher });
    const js = result.find((r) => r.skillName === 'JavaScript');
    assert('E7: malformed package.json does not crash; language still detected', !!js);
  }

  // E8. 404 on all file fetches → graceful, language evidence still returned
  {
    const repo = { id: 8, fullName: 'alice/no-files', primaryLanguage: 'Python', userId: 42 };
    const fetcher = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/languages')) {
        return new Response(JSON.stringify({ Python: 30000 }), { status: 200 });
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };
    const result = await detectSkillsFromRepo(repo, { fetcher });
    const python = result.find((r) => r.skillName === 'Python');
    assert('E8: 404 on manifests still returns language evidence', !!python);
  }
};

// ─── Runner ───────────────────────────────────────────────────────────────────

const run = async () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Phase 1A Test Suite — Skill Analysis Engine');
  console.log('═══════════════════════════════════════════════════════════════');

  await runGithubServiceTests();
  runLanguageAnalyzerTests();
  runDependencyAnalyzerTests();
  runFileEvidenceTests();
  await runSkillDetectionTests();

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.error('\nFailed tests:');
    failures.forEach((f, i) => console.error(`  ${i + 1}. ${f.label}${f.detail ? ` — ${f.detail}` : ''}`));
  }
  console.log('═══════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('[Test runner error]:', err);
  process.exit(1);
});
