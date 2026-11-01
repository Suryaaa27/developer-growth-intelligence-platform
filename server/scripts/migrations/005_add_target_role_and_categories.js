import 'dotenv/config';
import pool from '../../src/config/db.js';

/**
 * Migration 005: Add target_role to users and category to role_requirements
 *
 * 1. Adds `target_role` and `target_role_id` to `users` table so users' chosen
 *    engineering target role is preserved upon registration and profile update.
 * 2. Adds `category` to `role_requirements` table and populates the 8 requested
 *    career categories for clear grouped selection in Registration and Skill Gap Analysis.
 * 3. Backfills existing user accounts to guarantee no missing or broken values.
 * 4. Completely idempotent and non-destructive.
 */

export const ROLE_CATEGORY_MAP = {
  // Software Development
  'Java Backend Developer': 'Software Development',
  'Frontend Developer': 'Software Development',
  'Backend Developer': 'Software Development',
  'Full Stack Developer': 'Software Development',
  'Full Stack JavaScript Developer': 'Software Development',
  'Software Engineer': 'Software Development',
  'Python Developer': 'Software Development',
  'C#/.NET Developer': 'Software Development',
  'Go Developer': 'Software Development',

  // Mobile Development
  'Android Developer': 'Mobile Development',
  'iOS Developer': 'Mobile Development',
  'React Native Developer': 'Mobile Development',
  'Flutter Developer': 'Mobile Development',

  // Data Engineering & AI
  'Data Engineer': 'Data Engineering & AI',
  'Python Data Engineer': 'Data Engineering & AI',
  'Data Analyst': 'Data Engineering & AI',
  'Data Scientist': 'Data Engineering & AI',
  'Machine Learning Engineer': 'Data Engineering & AI',
  'AI Engineer': 'Data Engineering & AI',

  // DevOps & Cloud
  'DevOps Engineer': 'DevOps & Cloud',
  'DevOps & Cloud Engineer': 'DevOps & Cloud',
  'Cloud Engineer': 'DevOps & Cloud',
  'Site Reliability Engineer': 'DevOps & Cloud',
  'Platform Engineer': 'DevOps & Cloud',

  // Cybersecurity
  'Security Engineer': 'Cybersecurity',
  'Application Security Engineer': 'Cybersecurity',
  'Penetration Tester': 'Cybersecurity',

  // QA & Testing
  'QA Engineer': 'QA & Testing',
  'Test Automation Engineer': 'QA & Testing',
  'Software Development Engineer in Test (SDET)': 'QA & Testing',

  // Embedded & Systems
  'Embedded Software Engineer': 'Embedded & Systems',

  // Architecture & Specialized Engineering
  'Database Engineer': 'Architecture & Specialized Engineering',
  'API Engineer': 'Architecture & Specialized Engineering',
  'Software Architect': 'Architecture & Specialized Engineering',
};

export const runMigration = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('[Migration 005] Applying target_role and category columns...');

    // 1. Check users table columns
    const [userCols] = await connection.query('SHOW COLUMNS FROM users');
    const userColNames = userCols.map((c) => c.Field);

    if (!userColNames.includes('target_role')) {
      console.log('[Migration 005] Adding target_role column to users...');
      await connection.query(
        "ALTER TABLE users ADD COLUMN target_role VARCHAR(120) NULL DEFAULT 'Java Backend Developer' AFTER role"
      );
    }

    if (!userColNames.includes('target_role_id')) {
      console.log('[Migration 005] Adding target_role_id column to users...');
      await connection.query(
        'ALTER TABLE users ADD COLUMN target_role_id INT UNSIGNED NULL AFTER target_role'
      );
      await connection.query(
        'ALTER TABLE users ADD INDEX idx_users_target_role_id (target_role_id)'
      );
    }

    // 2. Check role_requirements table columns
    const [roleCols] = await connection.query('SHOW COLUMNS FROM role_requirements');
    const roleColNames = roleCols.map((c) => c.Field);

    if (!roleColNames.includes('category')) {
      console.log('[Migration 005] Adding category column to role_requirements...');
      await connection.query(
        'ALTER TABLE role_requirements ADD COLUMN category VARCHAR(80) NULL AFTER description'
      );
      await connection.query(
        'ALTER TABLE role_requirements ADD INDEX idx_role_requirements_category (category)'
      );
    }

    // 3. Populate / update categories in role_requirements
    console.log('[Migration 005] Populating role categories in role_requirements...');
    for (const [roleName, category] of Object.entries(ROLE_CATEGORY_MAP)) {
      await connection.query(
        'UPDATE role_requirements SET category = ? WHERE role_name = ?',
        [category, roleName]
      );
    }

    // Default any remaining unmapped roles to 'Software Development'
    await connection.query(
      "UPDATE role_requirements SET category = 'Software Development' WHERE category IS NULL OR category = ''"
    );

    // 4. Backfill existing users target_role and target_role_id
    console.log('[Migration 005] Backfilling existing users target role data...');
    const [defaultRoleRows] = await connection.query(
      "SELECT id, role_name FROM role_requirements WHERE role_name = 'Java Backend Developer' LIMIT 1"
    );
    const defaultRoleId = defaultRoleRows[0]?.id || null;
    const defaultRoleName = defaultRoleRows[0]?.role_name || 'Java Backend Developer';

    await connection.query(
      `UPDATE users
       SET target_role = COALESCE(NULLIF(target_role, ''), ?),
           target_role_id = COALESCE(target_role_id, ?)
       WHERE target_role IS NULL OR target_role = '' OR target_role_id IS NULL`,
      [defaultRoleName, defaultRoleId]
    );

    console.log('[Migration 005] Migration 005 completed successfully.');
  } finally {
    connection.release();
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('005_add_target_role_and_categories.js')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[Migration 005 Error]:', err);
      process.exit(1);
    });
}

