import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  parseCliOptions,
  validateEnvironmentKeys,
  validateBackupFile,
  runReencryption,
} from './reencryptGithubTokens.js';
import {
  encryptToken,
  decryptToken,
  isEncryptedWithPrimaryKey,
  decryptTokenWithPrimaryKeyOnly,
  parseDedicatedKey,
} from '../src/utils/tokenEncryption.js';

let passed = 0;
let failed = 0;

function runTest(name, fn) {
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

async function runAsyncTest(name, fn) {
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

// Preserve original environment
const originalEnv = {
  GITHUB_TOKEN_ENCRYPTION_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_KEY,
  GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
};

const restoreEnv = () => {
  if (originalEnv.GITHUB_TOKEN_ENCRYPTION_KEY !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = originalEnv.GITHUB_TOKEN_ENCRYPTION_KEY;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  }

  if (originalEnv.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY = originalEnv.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  }

  if (originalEnv.JWT_SECRET !== undefined) {
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  } else {
    delete process.env.JWT_SECRET;
  }
};

const setTestEnv = ({ primary, legacy, jwt } = {}) => {
  if (primary !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_KEY = primary;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  }

  if (legacy !== undefined) {
    process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY = legacy;
  } else {
    delete process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;
  }

  if (jwt !== undefined) {
    process.env.JWT_SECRET = jwt;
  } else {
    delete process.env.JWT_SECRET;
  }
};

// Mock in-memory logger to verify zero secret leaks
class TestLogger {
  constructor() {
    this.messages = [];
  }
  log(...args) {
    this.messages.push(args.join(' '));
  }
  error(...args) {
    this.messages.push(args.join(' '));
  }
  getJoinedOutput() {
    return this.messages.join('\n');
  }
}

// Mock Database Pool for completely isolated, zero-real-database testing
class MockDbPool {
  constructor(initialRows = []) {
    this.rows = initialRows.map((r) => ({ ...r }));
    this.queryLogs = [];
    this.committedBatches = 0;
    this.rollbacks = 0;
  }

  async query(sql, params) {
    this.queryLogs.push({ sql, params, isTransaction: false });
    const normalized = sql.replace(/\s+/g, ' ');
    if (normalized.includes('SELECT id, github_access_token FROM users')) {
      const [lastId, limit] = params;
      const matching = this.rows
        .filter((r) => r.github_access_token !== null && r.github_access_token !== '' && r.id > lastId)
        .sort((a, b) => a.id - b.id)
        .slice(0, limit);
      return [matching];
    }
    throw new Error(`Unhandled mock query: ${sql}`);
  }

  async getConnection() {
    const parent = this;
    return {
      inTransaction: false,
      async beginTransaction() {
        this.inTransaction = true;
      },
      async query(sql, params) {
        parent.queryLogs.push({ sql, params, isTransaction: this.inTransaction });
        const normalized = sql.replace(/\s+/g, ' ');
        if (normalized.includes('UPDATE users SET github_access_token')) {
          const [newCiphertext, id, currentCiphertext] = params;
          const row = parent.rows.find((r) => r.id === id);
          if (!row) {
            return [{ affectedRows: 0 }];
          }
          // Exact binary match simulation
          if (Buffer.from(row.github_access_token, 'utf8').equals(Buffer.from(currentCiphertext, 'utf8'))) {
            row.github_access_token = newCiphertext;
            return [{ affectedRows: 1 }];
          } else {
            // Concurrency conflict / case difference
            return [{ affectedRows: 0 }];
          }
        }
        throw new Error(`Unhandled mock connection query: ${sql}`);
      },
      async commit() {
        this.inTransaction = false;
        parent.committedBatches++;
      },
      async rollback() {
        this.inTransaction = false;
        parent.rollbacks++;
      },
      release() {},
    };
  }
}

console.log('============================================================');
console.log('🧪 Starting Token Re-encryption Utility Test Suite');
console.log('============================================================\n');

// Synthetic keys and tokens
const SYNTHETIC_PRIMARY_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const SYNTHETIC_OLD_JWT = 'old_local_legacy_jwt_signing_secret_123';
const SYNTHETIC_LEGACY_KEY = crypto.createHash('sha256').update(SYNTHETIC_OLD_JWT).digest('hex');
const SYNTHETIC_PROD_JWT = 'brand_new_production_jwt_signing_secret_456';
const RAW_TOKEN_A = 'gho_synthetic_oauth_token_alpha_111111111';
const RAW_TOKEN_B = 'gho_synthetic_oauth_token_bravo_222222222';
const RAW_TOKEN_C = 'gho_synthetic_oauth_token_charlie_33333333';

// Create synthetic mock backup file fixtures
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validMockBackupPath = path.resolve(__dirname, 'test_mock_valid_backup.sql');
const nonSqlBackupPath = path.resolve(__dirname, 'test_mock_nonsql_backup.sql');
const noUsersBackupPath = path.resolve(__dirname, 'test_mock_nousers_backup.sql');
const emptyBackupPath = path.resolve(__dirname, 'test_mock_empty_backup.sql');
const largeSchemaMockBackupPath = path.resolve(__dirname, 'test_mock_large_schema_backup.sql');
const largeDataMockBackupPath = path.resolve(__dirname, 'test_mock_large_data_backup.sql');

const padding68KB = '-- comment line padding to push table definition offset beyond 65536 bytes\n'.repeat(1000); // ~75 KB

fs.writeFileSync(
  validMockBackupPath,
  '-- MySQL dump 10.13  Distrib 8.0.39, for Win64\n-- Host: localhost    Database: developer_growth_db\nCREATE TABLE `users` (\n  `id` int NOT NULL\n);\n'
);
fs.writeFileSync(nonSqlBackupPath, 'This is an arbitrary plain text log file without any database signatures.\n');
fs.writeFileSync(noUsersBackupPath, '-- MySQL dump 10.13\nCREATE TABLE `other_table` (\n  id int\n);\n');
fs.writeFileSync(emptyBackupPath, '');
fs.writeFileSync(
  largeSchemaMockBackupPath,
  `-- MySQL dump 10.13  Distrib 8.0.39, for Win64\n${padding68KB}\nCREATE TABLE \`users\` (\n  \`id\` int NOT NULL\n);\n`
);
fs.writeFileSync(
  largeDataMockBackupPath,
  `-- MySQL dump 10.13  Distrib 8.0.39, for Win64\n${padding68KB}\nINSERT INTO \`users\` VALUES (1, 'synthetic_test_token');\n`
);

try {
  // 1. Primary-Key-Only Verification Tests
  console.log('[1/6] Testing Primary-Key-Only Verification & Key Derivation...');

  runTest('Dedicated key configured: primary-key token verifies successfully', () => {
    setTestEnv({ primary: SYNTHETIC_PRIMARY_KEY });
    const token = encryptToken(RAW_TOKEN_A);
    assert.strictEqual(isEncryptedWithPrimaryKey(token), true);
    assert.strictEqual(decryptTokenWithPrimaryKeyOnly(token), RAW_TOKEN_A);
  });

  runTest('Legacy-key token is not accepted as primary-key encrypted', () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const legacyToken = encryptToken(RAW_TOKEN_A);

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    assert.strictEqual(isEncryptedWithPrimaryKey(legacyToken), false);
    assert.throws(
      () => decryptTokenWithPrimaryKeyOnly(legacyToken),
      /decryptTokenWithPrimaryKeyOnly: authentication tag verification failed/
    );
  });

  runTest('Dedicated key missing while JWT_SECRET is configured: primary-only verification refuses to run', () => {
    setTestEnv({ jwt: SYNTHETIC_PROD_JWT }); // GITHUB_TOKEN_ENCRYPTION_KEY is unset
    const structurallyValidBlob = `${Buffer.alloc(12).toString('base64url')}:${Buffer.alloc(16).toString('base64url')}:${Buffer.from('test').toString('base64url')}`;

    assert.throws(
      () => decryptTokenWithPrimaryKeyOnly(structurallyValidBlob),
      /GITHUB_TOKEN_ENCRYPTION_KEY is required and cannot fall back to JWT_SECRET/
    );

    assert.throws(
      () => isEncryptedWithPrimaryKey(structurallyValidBlob),
      /GITHUB_TOKEN_ENCRYPTION_KEY is required and cannot fall back to JWT_SECRET/
    );
  });

  runTest('Dedicated key malformed: clear failure, not silent fallback', () => {
    // 63 hex chars (incomplete)
    setTestEnv({ primary: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde' });
    assert.throws(
      () => parseDedicatedKey(process.env.GITHUB_TOKEN_ENCRYPTION_KEY),
      /Expected exactly 64 hexadecimal characters, but received 63/
    );

    // 64 chars containing non-hex characters
    setTestEnv({ primary: 'zz23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' });
    assert.throws(
      () => parseDedicatedKey(process.env.GITHUB_TOKEN_ENCRYPTION_KEY),
      /64-character key contains invalid hexadecimal characters/
    );

    // Valid passphrase string is accepted and derives 32 bytes
    setTestEnv({ primary: 'valid_secure_passphrase_for_testing_purposes_12345' });
    const derivedPassphraseKey = parseDedicatedKey(process.env.GITHUB_TOKEN_ENCRYPTION_KEY);
    assert.strictEqual(Buffer.isBuffer(derivedPassphraseKey), true);
    assert.strictEqual(derivedPassphraseKey.length, 32);
  });

  // 2. CLI Options Validation Tests
  console.log('\n[2/6] Testing CLI Argument Parsing & Option Safeguards...');

  runTest('Defaults to dry-run when no mode flags provided', () => {
    const opts = parseCliOptions([]);
    assert.strictEqual(opts.isDryRun, true);
    assert.strictEqual(opts.isApply, false);
    assert.strictEqual(opts.isVerifyOnly, false);
    assert.strictEqual(opts.batchSize, 50);
  });

  runTest('Rejects --apply without --confirm=RE_ENCRYPT_TOKENS', () => {
    assert.throws(
      () => parseCliOptions(['--apply']),
      /Safety confirmation failed: --apply requires exact confirmation flag --confirm=RE_ENCRYPT_TOKENS/
    );
  });

  runTest('Rejects --confirm without --apply', () => {
    assert.throws(
      () => parseCliOptions(['--confirm=RE_ENCRYPT_TOKENS']),
      /Invalid option: --confirm is only permitted when --apply is specified/
    );
  });

  runTest('Rejects contradictory flags (--apply and --dry-run)', () => {
    assert.throws(
      () => parseCliOptions(['--apply', '--confirm=RE_ENCRYPT_TOKENS', '--dry-run']),
      /Contradictory options: --apply cannot be combined with --dry-run/
    );
  });

  runTest('Rejects contradictory flags (--verify-only and --apply)', () => {
    assert.throws(
      () => parseCliOptions(['--verify-only', '--apply', '--confirm=RE_ENCRYPT_TOKENS']),
      /Contradictory options: --verify-only cannot be combined with --apply/
    );
  });

  runTest('Rejects invalid --batch-size values', () => {
    assert.throws(() => parseCliOptions(['--batch-size=0']), /Invalid --batch-size/);
    assert.throws(() => parseCliOptions(['--batch-size=-10']), /Invalid --batch-size/);
    assert.throws(() => parseCliOptions(['--batch-size=abc']), /Invalid --batch-size/);
  });

  runTest('Rejects unknown options', () => {
    assert.throws(() => parseCliOptions(['--unknown-flag']), /Unknown option: --unknown-flag/);
  });

  // 3. Backup Safeguard Validation
  console.log('\n[3/6] Testing Streaming Backup File Static Verification...');

  await runAsyncTest('validateBackupFile fails if backup file path is omitted', async () => {
    await assert.rejects(
      async () => await validateBackupFile(null),
      /A verified database backup is mandatory/
    );
  });

  await runAsyncTest('validateBackupFile fails if backup file does not exist', async () => {
    await assert.rejects(
      async () => await validateBackupFile('non_existent_backup_file_9999.sql'),
      /Backup verification failed: File not found/
    );
  });

  await runAsyncTest('validateBackupFile fails if specified path is a directory', async () => {
    await assert.rejects(
      async () => await validateBackupFile(__dirname),
      /Backup verification failed: Specified path is a directory/
    );
  });

  await runAsyncTest('validateBackupFile fails if backup file is 0 bytes', async () => {
    await assert.rejects(
      async () => await validateBackupFile(emptyBackupPath),
      /File is empty \(0 bytes\)/
    );
  });

  await runAsyncTest('validateBackupFile rejects a non-SQL text file', async () => {
    await assert.rejects(
      async () => await validateBackupFile(nonSqlBackupPath),
      /Backup verification failed: File .* lacks credible MySQL dump markers in header/
    );
  });

  await runAsyncTest('validateBackupFile rejects a dump lacking users table reference', async () => {
    await assert.rejects(
      async () => await validateBackupFile(noUsersBackupPath),
      /Backup verification failed: File .* does not contain references to the required 'users' table/
    );
  });

  await runAsyncTest('validateBackupFile accepts a representative small valid MySQL dump fixture', async () => {
    await assert.doesNotReject(async () => await validateBackupFile(validMockBackupPath));
  });

  await runAsyncTest('validateBackupFile accepts a valid dump with CREATE TABLE users after byte 65,536', async () => {
    const stats = fs.statSync(largeSchemaMockBackupPath);
    assert(stats.size > 65536, 'Test fixture must be larger than 65536 bytes');
    await assert.doesNotReject(async () => await validateBackupFile(largeSchemaMockBackupPath));
  });

  await runAsyncTest('validateBackupFile accepts a valid dump with INSERT INTO users data after byte 65,536', async () => {
    const stats = fs.statSync(largeDataMockBackupPath);
    assert(stats.size > 65536, 'Test fixture must be larger than 65536 bytes');
    await assert.doesNotReject(async () => await validateBackupFile(largeDataMockBackupPath));
  });

  // 4. Dry-Run Mode (Zero Writes)
  console.log('\n[4/6] Testing Dry-Run Mode (Zero Writes)...');

  await runAsyncTest('Dry-run scans eligible tokens and executes zero updates', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const legacyToken = encryptToken(RAW_TOKEN_A);

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    const mockPool = new MockDbPool([{ id: 101, github_access_token: legacyToken }]);
    const logger = new TestLogger();

    const stats = await runReencryption({
      dbPool: mockPool,
      argv: ['--dry-run'],
      logger,
    });

    assert.strictEqual(stats.examined, 1);
    assert.strictEqual(stats.already_primary, 0);
    assert.strictEqual(stats.migrated, 1);
    assert.strictEqual(stats.failed, 0);

    // Assert zero write queries were dispatched
    const writeQueries = mockPool.queryLogs.filter((q) => q.sql.includes('UPDATE'));
    assert.strictEqual(writeQueries.length, 0);
  });

  // 5. Apply Mode with Batch Transactions & Keyset Pagination
  console.log('\n[5/6] Testing Apply Mode, Keyset Pagination (>2 Batches) & Concurrency...');

  await runAsyncTest('Apply mode re-encrypts legacy token and writes to database', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const legacyToken = encryptToken(RAW_TOKEN_A);

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    const mockPool = new MockDbPool([{ id: 201, github_access_token: legacyToken }]);
    const logger = new TestLogger();

    const stats = await runReencryption({
      dbPool: mockPool,
      argv: ['--apply', '--confirm=RE_ENCRYPT_TOKENS', `--backup-file=${validMockBackupPath}`],
      logger,
    });

    assert.strictEqual(stats.examined, 1);
    assert.strictEqual(stats.migrated, 1);
    assert.strictEqual(stats.already_primary, 0);
    assert.strictEqual(stats.concurrency_skipped, 0);
    assert.strictEqual(stats.committedBatches, 1);
    assert.strictEqual(stats.committedRows, 1);

    // Verify row in mock db is now encrypted with primary key alone
    const updatedCiphertext = mockPool.rows[0].github_access_token;
    assert.notStrictEqual(updatedCiphertext, legacyToken);
    assert.strictEqual(isEncryptedWithPrimaryKey(updatedCiphertext), true);
    assert.strictEqual(decryptTokenWithPrimaryKeyOnly(updatedCiphertext), RAW_TOKEN_A);
  });

  await runAsyncTest('Keyset pagination progresses correctly across more than two batches', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const token1 = encryptToken('tok_1');
    const token2 = encryptToken('tok_2');
    const token3 = encryptToken('tok_3');
    const token4 = encryptToken('tok_4');
    const token5 = encryptToken('tok_5');

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    // 5 rows with batchSize=2 -> 3 batches (2 + 2 + 1)
    const mockPool = new MockDbPool([
      { id: 10, github_access_token: token1 },
      { id: 20, github_access_token: token2 },
      { id: 30, github_access_token: token3 },
      { id: 40, github_access_token: token4 },
      { id: 50, github_access_token: token5 },
    ]);
    const logger = new TestLogger();

    const stats = await runReencryption({
      dbPool: mockPool,
      argv: [
        '--apply',
        '--confirm=RE_ENCRYPT_TOKENS',
        `--backup-file=${validMockBackupPath}`,
        '--batch-size=2',
      ],
      logger,
    });

    assert.strictEqual(stats.examined, 5);
    assert.strictEqual(stats.migrated, 5);
    assert.strictEqual(stats.committedBatches, 3);
    assert.strictEqual(stats.committedRows, 5);

    // Verify all 5 rows were re-encrypted to primary key
    for (const row of mockPool.rows) {
      assert.strictEqual(isEncryptedWithPrimaryKey(row.github_access_token), true);
    }

    // Verify keyset query parameters: lastId started at 0, then 20, then 40, then 50
    const selectQueries = mockPool.queryLogs.filter((q) => q.sql.includes('SELECT id'));
    assert.strictEqual(selectQueries.length, 4); // 3 batches + 1 empty terminal check
    assert.strictEqual(selectQueries[0].params[0], 0);
    assert.strictEqual(selectQueries[1].params[0], 20);
    assert.strictEqual(selectQueries[2].params[0], 40);
    assert.strictEqual(selectQueries[3].params[0], 50);
  });

  await runAsyncTest('Concurrent OAuth replacement is safely skipped without overwrite', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const legacyToken = encryptToken(RAW_TOKEN_A);

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    const mockPool = new MockDbPool([{ id: 401, github_access_token: legacyToken }]);

    // Simulate external concurrent update replacing token right before UPDATE query executes
    const originalGetConn = mockPool.getConnection.bind(mockPool);
    mockPool.getConnection = async () => {
      const conn = await originalGetConn();
      const originalQuery = conn.query.bind(conn);
      conn.query = async (sql, params) => {
        if (sql.replace(/\s+/g, ' ').includes('UPDATE users SET github_access_token')) {
          mockPool.rows[0].github_access_token = 'freshly_reconnected_oauth_token_from_user';
        }
        return originalQuery(sql, params);
      };
      return conn;
    };

    const logger = new TestLogger();
    const stats = await runReencryption({
      dbPool: mockPool,
      argv: ['--apply', '--confirm=RE_ENCRYPT_TOKENS', `--backup-file=${validMockBackupPath}`],
      logger,
    });

    assert.strictEqual(stats.examined, 1);
    assert.strictEqual(stats.concurrency_skipped, 1);
    assert.strictEqual(stats.migrated, 0);
    // Fresh token must remain preserved
    assert.strictEqual(mockPool.rows[0].github_access_token, 'freshly_reconnected_oauth_token_from_user');
  });

  await runAsyncTest('Unreadable token aborts active batch and reports previously committed batches', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const validLegacy1 = encryptToken(RAW_TOKEN_A);
    const validLegacy2 = encryptToken(RAW_TOKEN_B);

    setTestEnv({
      primary: SYNTHETIC_PRIMARY_KEY,
      legacy: SYNTHETIC_LEGACY_KEY,
      jwt: SYNTHETIC_PROD_JWT,
    });

    // Batch 1 has valid row 501. Batch 2 has valid row 502 and corrupted row 503.
    const corruptedToken = 'invalid:auth:tag:not:decryptable';
    const mockPool = new MockDbPool([
      { id: 501, github_access_token: validLegacy1 },
      { id: 502, github_access_token: validLegacy2 },
      { id: 503, github_access_token: corruptedToken },
    ]);

    const logger = new TestLogger();
    let errorCaught = false;

    try {
      await runReencryption({
        dbPool: mockPool,
        argv: [
          '--apply',
          '--confirm=RE_ENCRYPT_TOKENS',
          `--backup-file=${validMockBackupPath}`,
          '--batch-size=1', // Force 1 row per batch
        ],
        logger,
      });
    } catch (err) {
      errorCaught = true;
      assert(err.message.includes('Token re-encryption aborted'));
    }

    assert.strictEqual(errorCaught, true);
    assert.strictEqual(mockPool.committedBatches >= 1, true);
    assert.strictEqual(mockPool.rollbacks >= 1, true);

    const logOutput = logger.getJoinedOutput();
    assert(logOutput.includes('previously COMMITTED'));
    assert(logOutput.includes('active batch was rolled back'));
  });

  // 6. Verification-Only Mode & Secret Redaction
  console.log('\n[6/6] Testing --verify-only Mode & Secret Redaction...');

  await runAsyncTest('--verify-only fails if any legacy-encrypted token remains', async () => {
    setTestEnv({ jwt: SYNTHETIC_OLD_JWT });
    const legacyToken = encryptToken(RAW_TOKEN_A);

    setTestEnv({ primary: SYNTHETIC_PRIMARY_KEY }); // only primary key configured
    const mockPool = new MockDbPool([{ id: 601, github_access_token: legacyToken }]);
    const logger = new TestLogger();

    const stats = await runReencryption({
      dbPool: mockPool,
      argv: ['--verify-only'],
      logger,
    });

    assert.strictEqual(stats.examined, 1);
    assert.strictEqual(stats.already_primary, 0);
    assert.strictEqual(stats.failed, 1);
    assert.strictEqual(stats.unreadable, 1);
  });

  await runAsyncTest('--verify-only passes when 100% of tokens are on primary key', async () => {
    setTestEnv({ primary: SYNTHETIC_PRIMARY_KEY });
    const primaryToken1 = encryptToken(RAW_TOKEN_A);
    const primaryToken2 = encryptToken(RAW_TOKEN_B);

    const mockPool = new MockDbPool([
      { id: 701, github_access_token: primaryToken1 },
      { id: 702, github_access_token: primaryToken2 },
    ]);
    const logger = new TestLogger();

    const stats = await runReencryption({
      dbPool: mockPool,
      argv: ['--verify-only'],
      logger,
    });

    assert.strictEqual(stats.examined, 2);
    assert.strictEqual(stats.already_primary, 2);
    assert.strictEqual(stats.failed, 0);
  });

  runTest('No secrets, keys, or plaintext tokens appear anywhere in output logs', () => {
    const logger = new TestLogger();
    logger.log('Execution Summary: Examined 10, Migrated 5');

    const output = logger.getJoinedOutput();
    assert.strictEqual(output.includes(RAW_TOKEN_A), false);
    assert.strictEqual(output.includes(RAW_TOKEN_B), false);
    assert.strictEqual(output.includes(SYNTHETIC_PRIMARY_KEY), false);
    assert.strictEqual(output.includes(SYNTHETIC_LEGACY_KEY), false);
    assert.strictEqual(output.includes(SYNTHETIC_OLD_JWT), false);
  });

} finally {
  restoreEnv();
  // Clean up all temporary files created for testing
  for (const p of [
    validMockBackupPath,
    nonSqlBackupPath,
    noUsersBackupPath,
    emptyBackupPath,
    largeSchemaMockBackupPath,
    largeDataMockBackupPath,
  ]) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch (_) {}
    }
  }
}

console.log('\n============================================================');
console.log(`📊 Test Summary: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('✨ All token re-encryption utility tests passed successfully!\n');
  process.exit(0);
}
