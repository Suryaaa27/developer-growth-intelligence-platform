import pool from '../../src/config/db.js';

/**
 * Migration 007: Drop legacy tables — user_progress and recommendations.
 *
 * Both tables have been confirmed empty (0 rows) and are no longer referenced
 * by any active controller, service, route, or test in the application.
 *
 * Drop order is intentional:
 *   1. user_progress first — it holds an FK (recommendation_id → recommendations.id)
 *   2. recommendations second — only after the dependent table is removed
 *
 * WARNING: This migration is IRREVERSIBLE without a database backup.
 * A backup of these tables must exist at backup_pre_007.sql before running.
 */
export const runMigration = async () => {
  // Safety check: abort if either table unexpectedly contains rows
  const [[{ up_count }]] = await pool.query('SELECT COUNT(*) AS up_count FROM user_progress');
  const [[{ rec_count }]] = await pool.query('SELECT COUNT(*) AS rec_count FROM recommendations');

  if (Number(up_count) > 0 || Number(rec_count) > 0) {
    throw new Error(
      `Migration 007 aborted: tables are not empty ` +
      `(user_progress: ${up_count} rows, recommendations: ${rec_count} rows). ` +
      `Restore from backup_pre_007.sql before proceeding.`
    );
  }

  // Drop user_progress first (has FK → recommendations)
  await pool.query('DROP TABLE IF EXISTS user_progress');
  console.log('[Migration 007] Dropped legacy table: user_progress');

  // Drop recommendations (was referenced by user_progress, now safe)
  await pool.query('DROP TABLE IF EXISTS recommendations');
  console.log('[Migration 007] Dropped legacy table: recommendations');

  console.log('[Migration 007] Complete. Retained: user_roadmap_progress, recommendation_templates.');
};

// Allow running this migration in isolation:
//   node --env-file=server/.env server/scripts/migrations/007_drop_legacy_tables.js
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('migrations/007_drop_legacy_tables.js')) {
  import('dotenv/config').catch(() => {});
  runMigration()
    .then(() => {
      console.log('[Migration 007] Standalone run completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migration 007 Error]:', err.message);
      process.exit(1);
    })
    .finally(async () => {
      try { await pool.end(); } catch (_) {}
    });
}

