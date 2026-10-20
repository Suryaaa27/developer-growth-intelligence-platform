import 'dotenv/config';
import pool from '../src/config/db.js';

/**
 * Migration Script: 001_create_recommendation_templates
 * Non-destructive migration to add the recommendation_templates table.
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

    const [cols] = await pool.query('DESCRIBE recommendation_templates');
    console.log('[Migration] Table structure verified:', cols.map(c => `${c.Field} (${c.Type})`));

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
