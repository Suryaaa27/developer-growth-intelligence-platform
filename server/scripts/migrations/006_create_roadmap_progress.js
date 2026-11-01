import 'dotenv/config';
import pool from '../../src/config/db.js';

/**
 * Migration 006: Create user_roadmap_progress table
 *
 * Provides resilient, database-backed learning progress tracking:
 * - Stores task completion and in-progress status per user and target role.
 * - Uses stable task_key identifiers so roadmap regenerations do not reset progress.
 * - Completely isolates progress between different users and different roles.
 * - Idempotent and non-destructive.
 */
export const runMigration = async () => {
  console.log('[Migration 006] Ensuring user_roadmap_progress table exists...');

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS user_roadmap_progress (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      role_id INT UNSIGNED NOT NULL,
      task_key VARCHAR(100) NOT NULL,
      status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
      completed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_role_task (user_id, role_id, task_key),
      INDEX idx_roadmap_user_role (user_id, role_id),
      CONSTRAINT fk_roadmap_user_id FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_roadmap_role_id FOREIGN KEY (role_id) REFERENCES role_requirements (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await pool.query(createTableSql);
  console.log('[Migration 006] user_roadmap_progress table verified successfully.');
};

if (process.argv[1] && process.argv[1].endsWith('006_create_roadmap_progress.js')) {
  runMigration()
    .then(() => {
      console.log('[Migration 006] Completed standalone execution.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration 006 Error]:', err);
      process.exit(1);
    });
}

