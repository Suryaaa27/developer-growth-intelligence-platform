import 'dotenv/config';
import pool from '../../src/config/db.js';

/**
 * Migration 002: Add Repository Ownership & Fork Columns
 *
 * Adds:
 * - `owner_login` VARCHAR(100) NULL (indexed)
 * - `is_fork` BOOLEAN NOT NULL DEFAULT FALSE
 * Backfills `owner_login` from `full_name`.
 * Performs verified cleanup of stale test repositories for user 7.
 */
export const runMigration = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('[Migration 002] Checking repositories table columns...');

    // 1. Check existing columns
    const [columns] = await connection.query('SHOW COLUMNS FROM repositories');
    const columnNames = columns.map((c) => c.Field);

    // 2. Add owner_login if missing
    if (!columnNames.includes('owner_login')) {
      console.log('[Migration 002] Adding column owner_login to repositories...');
      await connection.query(
        'ALTER TABLE repositories ADD COLUMN owner_login VARCHAR(100) NULL AFTER repo_name'
      );
      await connection.query(
        'ALTER TABLE repositories ADD INDEX idx_repositories_owner_login (owner_login)'
      );
    }

    // 3. Add is_fork if missing
    if (!columnNames.includes('is_fork')) {
      console.log('[Migration 002] Adding column is_fork to repositories...');
      await connection.query(
        'ALTER TABLE repositories ADD COLUMN is_fork BOOLEAN NOT NULL DEFAULT FALSE AFTER html_url'
      );
    }

    // 4. Backfill owner_login from full_name (e.g. "Suryaaa27/gitflow" -> "Suryaaa27")
    console.log('[Migration 002] Backfilling owner_login from full_name...');
    await connection.query(`
      UPDATE repositories
      SET owner_login = SUBSTRING_INDEX(full_name, '/', 1)
      WHERE (owner_login IS NULL OR owner_login = '') AND full_name LIKE '%/%'
    `);

    // 5. Cleanup stale test repositories for user 7 (octocat and vsutar1010 test artifacts)
    // Note: Do not touch any unrelated users (e.g. user 109 Pranali).
    const [user7Rows] = await connection.query(
      'SELECT id, email, github_username FROM users WHERE id = 7'
    );

    if (user7Rows.length > 0) {
      console.log('[Migration 002] Auditing user 7 repositories for stale test records...');

      // Count stale rows before deletion
      const [staleRows] = await connection.query(
        `SELECT id, full_name FROM repositories
         WHERE user_id = 7 AND (full_name LIKE 'octocat/%' OR full_name LIKE 'vsutar1010/%')`
      );

      if (staleRows.length > 0) {
        console.log(`[Migration 002] Found ${staleRows.length} stale test repositories for user 7:`, staleRows.map(r => r.full_name));

        // Delete stale rows (CASCADE will delete corresponding skill_evidence)
        const [delResult] = await connection.query(
          `DELETE FROM repositories
           WHERE user_id = 7 AND (full_name LIKE 'octocat/%' OR full_name LIKE 'vsutar1010/%')`
        );
        console.log(`[Migration 002] Cleaned up ${delResult.affectedRows} stale test repository records for user 7.`);
      }

      // If user 7's github_username is 'Suryaa0809', update to 'Suryaaa27' to match their primary account
      if (user7Rows[0].github_username === 'Suryaa0809') {
        console.log('[Migration 002] Aligning user 7 verified github_username to Suryaaa27...');
        await connection.query(
          "UPDATE users SET github_username = 'Suryaaa27' WHERE id = 7"
        );
      }
    }

    console.log('[Migration 002] Migration completed successfully.');
  } finally {
    connection.release();
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('002_add_repo_ownership.js')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[Migration 002 Error]:', err);
      process.exit(1);
    });
}

