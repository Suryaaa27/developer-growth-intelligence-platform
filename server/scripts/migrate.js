import 'dotenv/config';
import pool from '../src/config/db.js';
import { runMigration as runOwnershipMigration } from './migrations/002_add_repo_ownership.js';
import { runMigration as runRoleSeedMigration } from './migrations/003_seed_role_requirements.js';

/**
 * Migration Script
 * Runs all non-destructive migrations in sequence.
 */
const migrate = async () => {
  try {
    console.log('[Migration] Applying recommendation_templates table migration...');
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS recommendation_templates (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        skill_name VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        resource_url VARCHAR(255) NULL,
        priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rec_templates_skill (skill_name),
        INDEX idx_rec_templates_priority (priority)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    await pool.query(createTableQuery);
    console.log('[Migration] Table recommendation_templates created successfully.');

    // Migration 002: Add repository ownership and fork tracking
    await runOwnershipMigration();

    // Migration 003: Seed default role requirement templates (idempotent INSERT IGNORE)
    await runRoleSeedMigration();

    process.exit(0);
  } catch (error) {
    console.error('[Migration Error]:', error);
    process.exit(1);
  } finally {
    try {
      await pool.end();
    } catch (_) {}
  }
};

migrate();
