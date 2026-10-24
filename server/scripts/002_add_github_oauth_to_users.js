import 'dotenv/config';
import pool from '../src/config/db.js';

/**
 * Migration Script: 002_add_github_oauth_to_users
 * Non-destructive migration to add GitHub OAuth identity columns and constraints to the users table.
 *
 * Changes:
 * - ADD COLUMN github_id BIGINT UNSIGNED NULL (unique identifier from GitHub)
 * - ADD COLUMN github_username VARCHAR(100) NULL (user's public handle)
 * - ADD CONSTRAINT uq_users_github_id UNIQUE (github_id) (ensures 1:1 GitHub to DevGrowth link)
 * - ADD INDEX idx_users_github_username (github_username) (fast lookup by username)
 *
 * Idempotence:
 * Checks existing columns and indexes via SHOW COLUMNS / SHOW INDEX before executing DDL,
 * ensuring the script is safe to rerun without throwing duplicate column or key errors.
 */
const migrate = async () => {
  try {
    console.log('[Migration 002] Starting GitHub OAuth database preparation...');

    // 1. Verify 'users' table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
    if (!tables || tables.length === 0) {
      throw new Error("Table 'users' does not exist in the database. Run initial schema migrations first.");
    }

    // 2. Inspect existing columns in 'users' table
    const [columns] = await pool.query('SHOW COLUMNS FROM users');
    const existingColumns = new Set(columns.map((c) => c.Field.toLowerCase()));

    // 3. Add 'github_id' if not present
    if (!existingColumns.has('github_id')) {
      console.log("[Migration 002] Adding column 'github_id' (BIGINT UNSIGNED NULL)...");
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN github_id BIGINT UNSIGNED NULL AFTER is_active
      `);
      console.log("[Migration 002] Column 'github_id' added successfully.");
    } else {
      console.log("[Migration 002] Column 'github_id' already exists. Skipping column addition.");
    }

    // 4. Add 'github_username' if not present
    if (!existingColumns.has('github_username')) {
      console.log("[Migration 002] Adding column 'github_username' (VARCHAR(100) NULL)...");
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN github_username VARCHAR(100) NULL AFTER github_id
      `);
      console.log("[Migration 002] Column 'github_username' added successfully.");
    } else {
      console.log("[Migration 002] Column 'github_username' already exists. Skipping column addition.");
    }

    // 5. Inspect existing indexes in 'users' table
    const [indexes] = await pool.query('SHOW INDEX FROM users');
    const existingIndexes = new Set(indexes.map((idx) => idx.Key_name.toLowerCase()));

    // 6. Add unique constraint 'uq_users_github_id' if not present
    if (!existingIndexes.has('uq_users_github_id')) {
      console.log("[Migration 002] Adding unique constraint 'uq_users_github_id' on github_id...");
      await pool.query(`
        ALTER TABLE users
        ADD CONSTRAINT uq_users_github_id UNIQUE (github_id)
      `);
      console.log("[Migration 002] Unique constraint 'uq_users_github_id' added successfully.");
    } else {
      console.log("[Migration 002] Constraint 'uq_users_github_id' already exists. Skipping constraint addition.");
    }

    // 7. Add index 'idx_users_github_username' if not present
    if (!existingIndexes.has('idx_users_github_username')) {
      console.log("[Migration 002] Adding index 'idx_users_github_username' on github_username...");
      await pool.query(`
        ALTER TABLE users
        ADD INDEX idx_users_github_username (github_username)
      `);
      console.log("[Migration 002] Index 'idx_users_github_username' added successfully.");
    } else {
      console.log("[Migration 002] Index 'idx_users_github_username' already exists. Skipping index addition.");
    }

    // 8. Verify and output current table structure
    const [updatedCols] = await pool.query('DESCRIBE users');
    console.log(
      '[Migration 002] Verified table columns:',
      updatedCols.map((c) => `${c.Field} (${c.Type}${c.Null === 'YES' ? ', NULL' : ', NOT NULL'})`)
    );

    const [updatedIndexes] = await pool.query('SHOW INDEX FROM users');
    const uniqueIndexNames = Array.from(new Set(updatedIndexes.map((idx) => idx.Key_name)));
    console.log('[Migration 002] Verified table indexes:', uniqueIndexNames);

    console.log('[Migration 002] Completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('[Migration 002 Error]:', error.message || error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (_) {}
  }
};

migrate();
