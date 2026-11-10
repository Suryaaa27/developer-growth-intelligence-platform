import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { fileURLToPath } from 'url';
import {
  encryptToken,
  decryptToken,
  isEncryptedWithPrimaryKey,
  decryptTokenWithPrimaryKeyOnly,
  parseDedicatedKey,
} from '../src/utils/tokenEncryption.js';

/**
 * Parse and validate command-line arguments.
 *
 * @param {string[]} argv
 * @returns {object} Parsed options
 */
export const parseCliOptions = (argv = process.argv.slice(2)) => {
  const options = {
    isDryRun: false,
    isApply: false,
    confirmValue: null,
    isVerifyOnly: false,
    batchSize: 50,
    backupFilePath: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.isDryRun = true;
    } else if (arg === '--apply') {
      options.isApply = true;
    } else if (arg.startsWith('--confirm=')) {
      options.confirmValue = arg.split('=')[1];
    } else if (arg === '--confirm') {
      options.confirmValue = true;
    } else if (arg === '--verify-only') {
      options.isVerifyOnly = true;
    } else if (arg.startsWith('--batch-size=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (isNaN(val) || val <= 0) {
        throw new Error('Invalid --batch-size: must be a positive integer.');
      }
      options.batchSize = val;
    } else if (arg.startsWith('--backup-file=')) {
      options.backupFilePath = arg.substring('--backup-file='.length).trim();
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  // Validate contradictory option combinations
  if (options.isVerifyOnly && options.isApply) {
    throw new Error('Contradictory options: --verify-only cannot be combined with --apply.');
  }

  if (options.isVerifyOnly && options.isDryRun) {
    throw new Error('Contradictory options: --verify-only cannot be combined with --dry-run.');
  }

  if (options.isApply && options.isDryRun) {
    throw new Error('Contradictory options: --apply cannot be combined with --dry-run.');
  }

  if (options.confirmValue && !options.isApply) {
    throw new Error('Invalid option: --confirm is only permitted when --apply is specified.');
  }

  if (options.isApply) {
    if (options.confirmValue !== 'RE_ENCRYPT_TOKENS') {
      throw new Error(
        'Safety confirmation failed: --apply requires exact confirmation flag --confirm=RE_ENCRYPT_TOKENS'
      );
    }
  }

  // Default to dry-run if neither apply nor verify-only was specified
  if (!options.isApply && !options.isVerifyOnly) {
    options.isDryRun = true;
  }

  return options;
};

/**
 * Validate required encryption keys from environment based on execution mode.
 *
 * @param {object} options
 */
export const validateEnvironmentKeys = (options) => {
  const primaryRaw = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  const legacyRaw = process.env.GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY;

  if (options.isApply || options.isDryRun) {
    if (!primaryRaw || typeof primaryRaw !== 'string' || !primaryRaw.trim()) {
      throw new Error(
        'Primary key configuration missing: GITHUB_TOKEN_ENCRYPTION_KEY must be set.'
      );
    }
    const primaryKey = parseDedicatedKey(primaryRaw);

    if (!legacyRaw || typeof legacyRaw !== 'string' || !/^[0-9a-fA-F]{64}$/.test(legacyRaw.trim())) {
      throw new Error(
        'Legacy key configuration missing or invalid: GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be a 64-character hexadecimal string.'
      );
    }
    const legacyKey = Buffer.from(legacyRaw.trim(), 'hex');

    if (primaryKey.equals(legacyKey)) {
      throw new Error(
        'Key configuration error: GITHUB_TOKEN_ENCRYPTION_KEY and GITHUB_TOKEN_ENCRYPTION_LEGACY_KEY must be distinct.'
      );
    }
  } else if (options.isVerifyOnly) {
    if (!primaryRaw || typeof primaryRaw !== 'string' || !primaryRaw.trim()) {
      throw new Error(
        'Primary key configuration missing: GITHUB_TOKEN_ENCRYPTION_KEY must be set for --verify-only.'
      );
    }
    parseDedicatedKey(primaryRaw);
  }
};

/**
 * Validate a backup file before permitting apply mode.
 *
 * Performs static sanity checks:
 *   - Verifies the file exists, is a regular file (not directory), and has non-zero size.
 *   - Uses a memory-efficient stream (readline) to inspect lines without loading the whole file into RAM.
 *   - Confirms credible MySQL/MariaDB dump markers near the beginning of the file (within the first 100 lines).
 *   - Continues streaming until a credible 'users' table definition or data statement is found, or EOF.
 *   - Ensures streams and handles are cleaned up properly on success and error.
 *
 * NOTE: This is a static sanity check only. It verifies credible file structure
 * but does NOT guarantee that the backup is syntactically complete, un-truncated,
 * or functionally restorable. Operators should perform trial restoration in an
 * isolated test container prior to production migration.
 *
 * @param {string|null} backupFilePath
 * @returns {Promise<void>}
 */
export const validateBackupFile = async (backupFilePath) => {
  if (!backupFilePath || typeof backupFilePath !== 'string' || !backupFilePath.trim()) {
    throw new Error(
      'Safety requirement: A verified database backup is mandatory before running with --apply.\n' +
      'Please supply --backup-file=<path/to/backup.sql>.'
    );
  }

  const resolvedPath = path.resolve(backupFilePath.trim());
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup verification failed: File not found at ${resolvedPath}`);
  }

  let stats;
  try {
    stats = fs.statSync(resolvedPath);
  } catch (err) {
    throw new Error(`Backup verification failed: Unable to read file stats at ${resolvedPath} (${err.message})`);
  }

  if (stats.isDirectory()) {
    throw new Error(`Backup verification failed: Specified path is a directory, not a file at ${resolvedPath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`Backup verification failed: Target path is not a regular file at ${resolvedPath}`);
  }

  if (stats.size === 0) {
    throw new Error(`Backup verification failed: File is empty (0 bytes) at ${resolvedPath}`);
  }

  // Memory-efficient streaming inspection via readline
  const fileStream = fs.createReadStream(resolvedPath, { encoding: 'utf8', highWaterMark: 64 * 1024 });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let hasDumpMarker = false;
  let hasUsersTable = false;

  const DUMP_MARKER_HEADER_LINE_LIMIT = 100; // Credible dump signature must appear in header lines

  try {
    for await (const line of rl) {
      lineNumber++;

      // 1. Check for credible MySQL/MariaDB dump signature in the header
      if (!hasDumpMarker && lineNumber <= DUMP_MARKER_HEADER_LINE_LIMIT) {
        if (/MySQL dump/i.test(line) || /mysqldump/i.test(line) || /MariaDB dump/i.test(line)) {
          hasDumpMarker = true;
        }
      }

      // If we passed the header lines without seeing a dump marker, abort early!
      if (!hasDumpMarker && lineNumber > DUMP_MARKER_HEADER_LINE_LIMIT) {
        break;
      }

      // 2. Check for credible users table definition or data insertion
      if (
        /`users`/i.test(line) ||
        /\bTABLE (IF NOT EXISTS )?`?users`?/i.test(line) ||
        /\bINTO `?users`?/i.test(line)
      ) {
        hasUsersTable = true;
        break; // Found both markers, can safely stop streaming
      }
    }
  } catch (err) {
    throw new Error(`Backup verification failed: Error streaming backup file at ${resolvedPath} (${err.message})`);
  } finally {
    rl.close();
    fileStream.destroy();
  }

  if (!hasDumpMarker) {
    throw new Error(
      `Backup verification failed: File at ${resolvedPath} lacks credible MySQL dump markers in header (expected 'MySQL dump' or 'mysqldump').`
    );
  }

  if (!hasUsersTable) {
    throw new Error(
      `Backup verification failed: File at ${resolvedPath} does not contain references to the required 'users' table.`
    );
  }
};

/**
 * Execute the token re-encryption workflow.
 *
 * @param {object} params
 * @param {object} [params.dbPool] - Optional injected database pool (defaults to db.js)
 * @param {string[]} [params.argv] - Command line arguments
 * @param {object} [params.logger] - Logger interface
 * @returns {Promise<object>} Aggregate statistics
 */
export const runReencryption = async ({
  dbPool = null,
  argv = process.argv.slice(2),
  logger = console,
} = {}) => {
  const options = parseCliOptions(argv);
  validateEnvironmentKeys(options);

  if (options.isApply) {
    await validateBackupFile(options.backupFilePath);
  }

  // Resolve database connection pool lazily if not injected
  let pool = dbPool;
  if (!pool) {
    const dbModule = await import('../src/config/db.js');
    pool = dbModule.default;
  }

  const modeName = options.isVerifyOnly
    ? 'VERIFY_ONLY'
    : options.isApply
    ? 'APPLY (ACTIVE WRITES)'
    : 'DRY_RUN (ZERO WRITES)';

  logger.log('============================================================');
  logger.log('🔐 GitHub Access-Token Re-encryption Utility');
  logger.log('============================================================');
  logger.log(`Execution Mode: ${modeName}`);
  logger.log(`Batch Size:     ${options.batchSize}`);
  if (options.isApply) {
    logger.log(`Verified Backup: ${path.resolve(options.backupFilePath)}`);
  }
  logger.log('------------------------------------------------------------');

  const stats = {
    mode: modeName,
    examined: 0,
    already_primary: 0,
    migrated: 0,
    concurrency_skipped: 0,
    unreadable: 0,
    failed: 0,
    committedBatches: 0,
    committedRows: 0,
  };

  let lastId = 0;
  let batchIndex = 0;

  try {
    while (true) {
      const [rows] = await pool.query(
        `SELECT id, github_access_token 
         FROM users 
         WHERE github_access_token IS NOT NULL AND github_access_token != '' AND id > ? 
         ORDER BY id ASC 
         LIMIT ?`,
        [lastId, options.batchSize]
      );

      if (!rows || rows.length === 0) {
        break;
      }

      lastId = rows[rows.length - 1].id;
      batchIndex++;

      if (options.isVerifyOnly) {
        // Mode 1: Verify-only (tests decryption with primary key only)
        for (const row of rows) {
          stats.examined++;
          try {
            decryptTokenWithPrimaryKeyOnly(row.github_access_token);
            stats.already_primary++;
          } catch {
            stats.unreadable++;
            stats.failed++;
          }
        }
      } else if (options.isDryRun) {
        // Mode 2: Dry-run (evaluates without writes)
        for (const row of rows) {
          stats.examined++;
          if (isEncryptedWithPrimaryKey(row.github_access_token)) {
            stats.already_primary++;
            continue;
          }
          try {
            decryptToken(row.github_access_token);
            stats.migrated++;
          } catch {
            stats.unreadable++;
            stats.failed++;
          }
        }
      } else if (options.isApply) {
        // Mode 3: Apply (atomic bounded batch transactions with OCC)
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          const updates = [];
          for (const row of rows) {
            stats.examined++;
            if (isEncryptedWithPrimaryKey(row.github_access_token)) {
              stats.already_primary++;
              continue;
            }

            let plaintext;
            try {
              plaintext = decryptToken(row.github_access_token);
            } catch {
              stats.unreadable++;
              stats.failed++;
              throw new Error(
                `Token re-encryption aborted: User ID ${row.id} has an unreadable or corrupted token that failed authentication.`
              );
            }

            const newCiphertext = encryptToken(plaintext);
            updates.push({
              id: row.id,
              currentCiphertext: row.github_access_token,
              newCiphertext,
            });
          }

          let batchMigrated = 0;
          let batchSkipped = 0;

          for (const item of updates) {
            const [result] = await conn.query(
              `UPDATE users 
               SET github_access_token = ?, updated_at = updated_at 
               WHERE id = ? AND BINARY github_access_token = BINARY ?`,
              [item.newCiphertext, item.id, item.currentCiphertext]
            );

            if (result.affectedRows === 1) {
              batchMigrated++;
            } else {
              batchSkipped++;
            }
          }

          await conn.commit();
          stats.migrated += batchMigrated;
          stats.concurrency_skipped += batchSkipped;
          if (updates.length > 0) {
            stats.committedBatches++;
            stats.committedRows += batchMigrated;
          }
        } catch (batchErr) {
          await conn.rollback();
          throw batchErr;
        } finally {
          conn.release();
        }
      }
    }
  } catch (err) {
    logger.error(`\n❌ Error: ${err.message}`);
    if (stats.committedBatches > 0) {
      logger.error(
        `⚠️ Batches 1 through ${stats.committedBatches} (${stats.committedRows} row(s)) were previously COMMITTED.\n` +
        `The active batch was rolled back. Re-running the utility after resolving the issue is safe and idempotent.`
      );
    } else if (options.isApply) {
      logger.error('⚠️ Active batch was rolled back. 0 rows committed.');
    }
    stats.failed++;
    throw err;
  }

  logger.log('\n============================================================');
  logger.log('📊 Aggregate Execution Summary');
  logger.log('============================================================');
  logger.log(`Total Tokens Examined:   ${stats.examined}`);
  logger.log(`Already on Primary Key:  ${stats.already_primary}`);
  logger.log(`Successfully Migrated:   ${stats.migrated}`);
  logger.log(`Concurrency Skips:       ${stats.concurrency_skipped}`);
  logger.log(`Unreadable / Corrupted:  ${stats.unreadable}`);
  logger.log(`Failed Items:            ${stats.failed}`);
  if (options.isApply) {
    logger.log(`Committed Batches:       ${stats.committedBatches}`);
    logger.log(`Committed Rows:          ${stats.committedRows}`);
  }
  logger.log('============================================================\n');

  return stats;
};

// Auto-run if executed directly via CLI
const isDirectExecution = () => {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
};

if (isDirectExecution()) {
  runReencryption().then(
    (stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    },
    (err) => {
      process.exit(1);
    }
  );
}
