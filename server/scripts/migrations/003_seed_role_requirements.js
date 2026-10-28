import 'dotenv/config';
import pool from '../../src/config/db.js';

/**
 * Migration 003: Seed Default Role Requirement Templates
 *
 * Seeds 4 realistic engineering role profiles into role_requirements.
 * Uses INSERT IGNORE on role_name to remain fully idempotent — running this
 * multiple times will never duplicate or overwrite existing custom roles.
 *
 * Each required_skills entry has:
 *   { name, category, benchmarkScore }
 * matching the shape expected by AdminJobRoles.jsx and SkillGaps.jsx CAREER_TRACKS.
 */
export const runMigration = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('[Migration 003] Seeding default role requirement templates...');

    const roles = [
      {
        role_name: 'Java Backend Developer',
        description:
          'Core microservices, relational persistence, Spring ecosystem, containerization, and automated testing for enterprise Java systems.',
        required_skills: [
          { name: 'Java', category: 'Language', benchmarkScore: 80 },
          { name: 'Spring Boot', category: 'Framework', benchmarkScore: 75 },
          { name: 'MySQL', category: 'Database', benchmarkScore: 65 },
          { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
          { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 55 },
          { name: 'JUnit', category: 'Testing', benchmarkScore: 55 },
        ],
      },
      {
        role_name: 'Full Stack JavaScript Developer',
        description:
          'Modern Node.js / Express REST APIs, React or Next.js frontends, database integration, and automated testing pipelines.',
        required_skills: [
          { name: 'JavaScript', category: 'Language', benchmarkScore: 80 },
          { name: 'TypeScript', category: 'Language', benchmarkScore: 65 },
          { name: 'React', category: 'Frontend', benchmarkScore: 75 },
          { name: 'Express.js', category: 'Backend', benchmarkScore: 70 },
          { name: 'MongoDB', category: 'Database', benchmarkScore: 60 },
          { name: 'Jest', category: 'Testing', benchmarkScore: 55 },
          { name: 'Docker', category: 'DevOps', benchmarkScore: 55 },
        ],
      },
      {
        role_name: 'DevOps & Cloud Engineer',
        description:
          'Infrastructure as Code, CI/CD pipeline automation, container orchestration, cloud configurations, and monitoring.',
        required_skills: [
          { name: 'Docker', category: 'DevOps', benchmarkScore: 80 },
          { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 75 },
          { name: 'Terraform', category: 'DevOps', benchmarkScore: 65 },
          { name: 'Python', category: 'Language', benchmarkScore: 60 },
          { name: 'Shell', category: 'Language', benchmarkScore: 55 },
        ],
      },
      {
        role_name: 'Python Data Engineer',
        description:
          'Data pipeline construction, ETL workflows, Python scripting, SQL databases, and cloud data platform integration.',
        required_skills: [
          { name: 'Python', category: 'Language', benchmarkScore: 80 },
          { name: 'PostgreSQL', category: 'Database', benchmarkScore: 65 },
          { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
          { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 50 },
        ],
      },
    ];

    let inserted = 0;
    let skipped = 0;
    for (const role of roles) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO role_requirements (role_name, description, required_skills)
         VALUES (?, ?, ?)`,
        [role.role_name, role.description, JSON.stringify(role.required_skills)]
      );
      if (result.affectedRows > 0) {
        inserted++;
        console.log(`[Migration 003]   + Inserted: "${role.role_name}"`);
      } else {
        skipped++;
        console.log(`[Migration 003]   ~ Skipped (already exists): "${role.role_name}"`);
      }
    }

    console.log(
      `[Migration 003] Done. ${inserted} role(s) inserted, ${skipped} role(s) already existed.`
    );
  } finally {
    connection.release();
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('003_seed_role_requirements.js')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[Migration 003 Error]:', err);
      process.exit(1);
    });
}

