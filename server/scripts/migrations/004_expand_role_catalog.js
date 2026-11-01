import 'dotenv/config';
import pool from '../../src/config/db.js';

/**
 * Migration 004: Expand Job Role Catalog (~30 Engineering Roles)
 *
 * Expands the role catalog across 7 key engineering disciplines:
 *  A. Software Development
 *  B. Mobile Development
 *  C. Data Engineering and AI
 *  D. DevOps and Cloud
 *  E. Cybersecurity
 *  F. QA and Testing
 *  G. Systems and Specialized Engineering
 *
 * Uses `INSERT IGNORE` on `role_name` (which has a UNIQUE constraint)
 * so existing built-in roles (IDs 9-12) and any custom admin-created
 * roles are preserved completely intact and never duplicated.
 */

export const EXPANDED_ROLE_CATALOG = [
  // ─── A. SOFTWARE DEVELOPMENT ─────────────────────────────────────────────
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
    role_name: 'Frontend Developer',
    description:
      'Modern web interfaces, responsive design, component architecture, client-side state management, and web performance optimization.',
    required_skills: [
      { name: 'JavaScript', category: 'Language', benchmarkScore: 85 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 75 },
      { name: 'React', category: 'Frontend', benchmarkScore: 80 },
      { name: 'HTML', category: 'Frontend', benchmarkScore: 85 },
      { name: 'CSS', category: 'Frontend', benchmarkScore: 80 },
      { name: 'Vite', category: 'Tool', benchmarkScore: 65 },
      { name: 'Jest', category: 'Testing', benchmarkScore: 60 },
    ],
  },
  {
    role_name: 'Backend Developer',
    description:
      'Robust server-side architecture, REST & GraphQL APIs, database modeling, secure authentication, and scalable microservices.',
    required_skills: [
      { name: 'Node.js', category: 'Backend', benchmarkScore: 75 },
      { name: 'Express.js', category: 'Backend', benchmarkScore: 75 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 70 },
      { name: 'Redis', category: 'Database', benchmarkScore: 60 },
      { name: 'JWT Authentication', category: 'Architecture', benchmarkScore: 70 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
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
    role_name: 'Full Stack Developer',
    description:
      'End-to-end web application development encompassing frontends, backend APIs, relational & NoSQL databases, and deployment pipelines.',
    required_skills: [
      { name: 'JavaScript', category: 'Language', benchmarkScore: 80 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 70 },
      { name: 'React', category: 'Frontend', benchmarkScore: 75 },
      { name: 'Node.js', category: 'Backend', benchmarkScore: 75 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 65 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
      { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 55 },
    ],
  },
  {
    role_name: 'Software Engineer',
    description:
      'General software engineering foundation covering core algorithms, clean object-oriented design, automated testing, and CI/CD best practices.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 70 },
      { name: 'Java', category: 'Language', benchmarkScore: 70 },
      { name: 'SQL', category: 'Database', benchmarkScore: 65 },
      { name: 'Git', category: 'Tool', benchmarkScore: 75 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
      { name: 'Automated Testing', category: 'Testing', benchmarkScore: 65 },
    ],
  },
  {
    role_name: 'Python Developer',
    description:
      'High-performance Python backend services, asynchronous APIs, data modeling, automated testing, and cloud integration.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 85 },
      { name: 'FastAPI', category: 'Backend', benchmarkScore: 70 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 65 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
      { name: 'pytest', category: 'Testing', benchmarkScore: 60 },
      { name: 'Redis', category: 'Database', benchmarkScore: 55 },
    ],
  },
  {
    role_name: 'C#/.NET Developer',
    description:
      'Enterprise .NET Core Web APIs, Entity Framework persistence, C# asynchronous programming, and Microsoft Azure ecosystem integration.',
    required_skills: [
      { name: 'C#', category: 'Language', benchmarkScore: 85 },
      { name: '.NET', category: 'Framework', benchmarkScore: 80 },
      { name: 'SQL Server', category: 'Database', benchmarkScore: 70 },
      { name: 'Entity Framework', category: 'Database', benchmarkScore: 70 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
      { name: 'Unit Testing', category: 'Testing', benchmarkScore: 60 },
    ],
  },
  {
    role_name: 'Go Developer',
    description:
      'Concurrent, high-throughput microservices, network services, gRPC/REST APIs, and distributed systems engineering using Go.',
    required_skills: [
      { name: 'Go', category: 'Language', benchmarkScore: 85 },
      { name: 'gRPC', category: 'Architecture', benchmarkScore: 70 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 70 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 65 },
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 60 },
      { name: 'Redis', category: 'Database', benchmarkScore: 60 },
    ],
  },

  // ─── B. MOBILE DEVELOPMENT ────────────────────────────────────────────────
  {
    role_name: 'Android Developer',
    description:
      'Native Android applications, modern Kotlin coroutines, Jetpack Compose UI, offline caching, and Google Play integration.',
    required_skills: [
      { name: 'Kotlin', category: 'Language', benchmarkScore: 85 },
      { name: 'Java', category: 'Language', benchmarkScore: 70 },
      { name: 'Android SDK', category: 'Mobile', benchmarkScore: 80 },
      { name: 'SQLite', category: 'Database', benchmarkScore: 65 },
      { name: 'Gradle', category: 'Tool', benchmarkScore: 65 },
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 70 },
    ],
  },
  {
    role_name: 'iOS Developer',
    description:
      'Native iOS applications, Swift, SwiftUI/UIKit architecture, CoreData persistence, and App Store delivery pipelines.',
    required_skills: [
      { name: 'Swift', category: 'Language', benchmarkScore: 85 },
      { name: 'SwiftUI', category: 'Mobile', benchmarkScore: 75 },
      { name: 'CoreData', category: 'Database', benchmarkScore: 65 },
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 70 },
      { name: 'Xcode', category: 'Tool', benchmarkScore: 75 },
    ],
  },
  {
    role_name: 'React Native Developer',
    description:
      'Cross-platform mobile apps for iOS and Android using React Native, native modules, TypeScript, and state management.',
    required_skills: [
      { name: 'React Native', category: 'Framework', benchmarkScore: 85 },
      { name: 'JavaScript', category: 'Language', benchmarkScore: 80 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 75 },
      { name: 'React', category: 'Frontend', benchmarkScore: 80 },
      { name: 'Mobile Architecture', category: 'Architecture', benchmarkScore: 65 },
      { name: 'Jest', category: 'Testing', benchmarkScore: 60 },
    ],
  },
  {
    role_name: 'Flutter Developer',
    description:
      'Multi-platform mobile and desktop interfaces built with Dart and Flutter framework, widget architecture, and reactive state.',
    required_skills: [
      { name: 'Dart', category: 'Language', benchmarkScore: 85 },
      { name: 'Flutter', category: 'Framework', benchmarkScore: 85 },
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 70 },
      { name: 'State Management', category: 'Architecture', benchmarkScore: 65 },
      { name: 'Mobile Testing', category: 'Testing', benchmarkScore: 60 },
    ],
  },

  // ─── C. DATA ENGINEERING AND AI ───────────────────────────────────────────
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
  {
    role_name: 'Data Engineer',
    description:
      'Large-scale data processing pipelines, ETL/ELT orchestration, distributed computing, streaming, and data warehousing.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 80 },
      { name: 'SQL', category: 'Database', benchmarkScore: 80 },
      { name: 'Apache Kafka', category: 'Tool', benchmarkScore: 70 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 70 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
      { name: 'ETL Pipelines', category: 'Architecture', benchmarkScore: 75 },
    ],
  },
  {
    role_name: 'Data Analyst',
    description:
      'Exploratory data analysis, SQL querying, statistical data modeling, Jupyter notebooks, and executive dashboard reporting.',
    required_skills: [
      { name: 'SQL', category: 'Database', benchmarkScore: 85 },
      { name: 'Python', category: 'Language', benchmarkScore: 75 },
      { name: 'Python (Jupyter)', category: 'Language', benchmarkScore: 70 },
      { name: 'Pandas', category: 'Tool', benchmarkScore: 75 },
      { name: 'Data Visualization', category: 'Tool', benchmarkScore: 65 },
    ],
  },
  {
    role_name: 'Data Scientist',
    description:
      'Statistical modeling, hypothesis testing, predictive analytics, feature engineering, and scientific Python computing.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 85 },
      { name: 'Python (Jupyter)', category: 'Language', benchmarkScore: 75 },
      { name: 'R', category: 'Language', benchmarkScore: 60 },
      { name: 'SQL', category: 'Database', benchmarkScore: 75 },
      { name: 'Machine Learning', category: 'Architecture', benchmarkScore: 75 },
      { name: 'Data Modeling', category: 'Architecture', benchmarkScore: 70 },
    ],
  },
  {
    role_name: 'Machine Learning Engineer',
    description:
      'Production ML systems, model training & evaluation pipelines, ML serving APIs, containerized inferencing, and MLOps.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 85 },
      { name: 'Python (Jupyter)', category: 'Language', benchmarkScore: 70 },
      { name: 'PyTorch / TensorFlow', category: 'Framework', benchmarkScore: 75 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 70 },
      { name: 'FastAPI', category: 'Backend', benchmarkScore: 65 },
      { name: 'Model Deployment', category: 'Architecture', benchmarkScore: 70 },
    ],
  },
  {
    role_name: 'AI Engineer',
    description:
      'Modern LLM integration, prompt orchestration, retrieval-augmented generation (RAG), vector storage, and AI application architectures.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 85 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 70 },
      { name: 'Vector Databases', category: 'Database', benchmarkScore: 70 },
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 75 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
      { name: 'Prompt Architecture', category: 'Architecture', benchmarkScore: 70 },
    ],
  },

  // ─── D. DEVOPS AND CLOUD ──────────────────────────────────────────────────
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
    role_name: 'DevOps Engineer',
    description:
      'Automated deployment pipelines, containerization, configuration management, automated testing gates, and Linux operations.',
    required_skills: [
      { name: 'Docker', category: 'DevOps', benchmarkScore: 85 },
      { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 80 },
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 75 },
      { name: 'Terraform', category: 'DevOps', benchmarkScore: 70 },
      { name: 'Shell Scripting', category: 'Language', benchmarkScore: 70 },
      { name: 'CI/CD Pipelines', category: 'Tool', benchmarkScore: 80 },
    ],
  },
  {
    role_name: 'Cloud Engineer',
    description:
      'Cloud infrastructure provisioning, serverless architectures, virtual networking, cloud security policies, and cost governance.',
    required_skills: [
      { name: 'Terraform', category: 'DevOps', benchmarkScore: 80 },
      { name: 'AWS SDK', category: 'Tool', benchmarkScore: 75 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 75 },
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 70 },
      { name: 'Shell Scripting', category: 'Language', benchmarkScore: 65 },
      { name: 'Cloud Architecture', category: 'Architecture', benchmarkScore: 75 },
    ],
  },
  {
    role_name: 'Site Reliability Engineer',
    description:
      'Service level objectives (SLOs), observability, automated incident remediation, distributed tracing, and resilience engineering.',
    required_skills: [
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 80 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 80 },
      { name: 'Python', category: 'Language', benchmarkScore: 75 },
      { name: 'Shell Scripting', category: 'Language', benchmarkScore: 70 },
      { name: 'Micrometer (Observability)', category: 'Tool', benchmarkScore: 65 },
      { name: 'CI/CD Pipelines', category: 'Tool', benchmarkScore: 70 },
    ],
  },
  {
    role_name: 'Platform Engineer',
    description:
      'Internal developer platforms (IDP), reusable infrastructure templates, developer toolchains, container orchestration, and GitOps.',
    required_skills: [
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 85 },
      { name: 'Helm (Kubernetes)', category: 'Tool', benchmarkScore: 75 },
      { name: 'Terraform', category: 'DevOps', benchmarkScore: 80 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 80 },
      { name: 'Go', category: 'Language', benchmarkScore: 70 },
      { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 75 },
    ],
  },

  // ─── E. CYBERSECURITY ─────────────────────────────────────────────────────
  {
    role_name: 'Security Engineer',
    description:
      'Application security controls, cryptographic key management, threat modeling, vulnerability scanning, and security CI/CD gates.',
    required_skills: [
      { name: 'Security Fundamentals', category: 'Architecture', benchmarkScore: 80 },
      { name: 'JWT Authentication', category: 'Architecture', benchmarkScore: 75 },
      { name: 'bcrypt (Security)', category: 'Tool', benchmarkScore: 70 },
      { name: 'Python', category: 'Language', benchmarkScore: 70 },
      { name: 'SonarQube (Code Quality)', category: 'Tool', benchmarkScore: 65 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 60 },
    ],
  },
  {
    role_name: 'Application Security Engineer',
    description:
      'OWASP mitigation, static & dynamic security testing (SAST/DAST), secure coding standards, dependency audits, and authentication protocols.',
    required_skills: [
      { name: 'OWASP Security', category: 'Architecture', benchmarkScore: 85 },
      { name: 'JWT Authentication', category: 'Architecture', benchmarkScore: 80 },
      { name: 'SonarQube (Code Quality)', category: 'Tool', benchmarkScore: 75 },
      { name: 'JavaScript', category: 'Language', benchmarkScore: 70 },
      { name: 'Python', category: 'Language', benchmarkScore: 70 },
      { name: 'Dependency Auditing', category: 'Tool', benchmarkScore: 75 },
    ],
  },
  {
    role_name: 'Penetration Tester',
    description:
      'Network penetration analysis, web application vulnerability exploitation, scripting offensive tools, and reporting remediation paths.',
    required_skills: [
      { name: 'Python', category: 'Language', benchmarkScore: 85 },
      { name: 'Shell Scripting', category: 'Language', benchmarkScore: 80 },
      { name: 'Network Protocols', category: 'Architecture', benchmarkScore: 75 },
      { name: 'Web Security Testing', category: 'Testing', benchmarkScore: 80 },
      { name: 'Linux', category: 'Tool', benchmarkScore: 80 },
    ],
  },

  // ─── F. QA AND TESTING ────────────────────────────────────────────────────
  {
    role_name: 'QA Engineer',
    description:
      'Manual and automated test strategy, regression test suites, bug tracking lifecycle, API functional testing, and quality metrics.',
    required_skills: [
      { name: 'Automated Testing', category: 'Testing', benchmarkScore: 75 },
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 70 },
      { name: 'JavaScript', category: 'Language', benchmarkScore: 65 },
      { name: 'Postman / API Testing', category: 'Tool', benchmarkScore: 75 },
      { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 60 },
    ],
  },
  {
    role_name: 'Test Automation Engineer',
    description:
      'End-to-end automated UI & API regression frameworks, continuous testing in CI pipelines, and cross-browser test suites.',
    required_skills: [
      { name: 'Playwright (E2E Testing)', category: 'Tool', benchmarkScore: 80 },
      { name: 'Cypress (E2E Testing)', category: 'Tool', benchmarkScore: 80 },
      { name: 'Jest (Testing)', category: 'Tool', benchmarkScore: 75 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 75 },
      { name: 'GitHub Actions', category: 'DevOps', benchmarkScore: 65 },
    ],
  },
  {
    role_name: 'Software Development Engineer in Test (SDET)',
    description:
      'Engineering robust testing infrastructure, performance load tests, contract testing, mock services, and CI integration.',
    required_skills: [
      { name: 'Java', category: 'Language', benchmarkScore: 75 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 75 },
      { name: 'JUnit 5', category: 'Tool', benchmarkScore: 75 },
      { name: 'Playwright (E2E Testing)', category: 'Tool', benchmarkScore: 75 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 70 },
      { name: 'CI/CD Pipelines', category: 'Tool', benchmarkScore: 70 },
    ],
  },

  // ─── G. SYSTEMS AND SPECIALIZED ENGINEERING ───────────────────────────────
  {
    role_name: 'Embedded Software Engineer',
    description:
      'Low-level hardware firmware, real-time operating systems (RTOS), C/C++ memory management, microcontrollers, and communication protocols.',
    required_skills: [
      { name: 'C', category: 'Language', benchmarkScore: 90 },
      { name: 'C++', category: 'Language', benchmarkScore: 85 },
      { name: 'Embedded Systems', category: 'Architecture', benchmarkScore: 80 },
      { name: 'Shell Scripting', category: 'Language', benchmarkScore: 65 },
      { name: 'Git', category: 'Tool', benchmarkScore: 70 },
    ],
  },
  {
    role_name: 'Database Engineer',
    description:
      'Relational and NoSQL engine tuning, schema migrations, query plan optimization, replication, high availability, and indexing strategies.',
    required_skills: [
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 85 },
      { name: 'MySQL', category: 'Database', benchmarkScore: 85 },
      { name: 'Redis', category: 'Database', benchmarkScore: 75 },
      { name: 'Flyway (DB Migrations)', category: 'Tool', benchmarkScore: 70 },
      { name: 'SQL Optimization', category: 'Database', benchmarkScore: 80 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
    ],
  },
  {
    role_name: 'API Engineer',
    description:
      'API gateway integration, RESTful and GraphQL API contracts, schema validation, rate-limiting architecture, and developer portal documentation.',
    required_skills: [
      { name: 'REST APIs', category: 'Architecture', benchmarkScore: 85 },
      { name: 'GraphQL', category: 'Architecture', benchmarkScore: 75 },
      { name: 'Express.js', category: 'Framework', benchmarkScore: 75 },
      { name: 'TypeScript', category: 'Language', benchmarkScore: 75 },
      { name: 'JWT Authentication', category: 'Architecture', benchmarkScore: 70 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 65 },
    ],
  },
  {
    role_name: 'Software Architect',
    description:
      'High-level technical strategy, microservice decomposition, domain-driven design, asynchronous messaging, and architectural governance.',
    required_skills: [
      { name: 'System Architecture', category: 'Architecture', benchmarkScore: 85 },
      { name: 'Microservices', category: 'Architecture', benchmarkScore: 85 },
      { name: 'Docker', category: 'DevOps', benchmarkScore: 75 },
      { name: 'Kubernetes', category: 'DevOps', benchmarkScore: 75 },
      { name: 'Apache Kafka', category: 'Tool', benchmarkScore: 70 },
      { name: 'PostgreSQL', category: 'Database', benchmarkScore: 70 },
    ],
  },
];

/**
 * Executes migration 004 to seed the expanded engineering role catalog.
 */
export const runMigration = async () => {
  const connection = await pool.getConnection();
  try {
    console.log('[Migration 004] Expanding job-role catalog to ~30 engineering roles...');

    let inserted = 0;
    let skipped = 0;

    for (const role of EXPANDED_ROLE_CATALOG) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO role_requirements (role_name, description, required_skills)
         VALUES (?, ?, ?)`,
        [role.role_name, role.description, JSON.stringify(role.required_skills)]
      );

      if (result.affectedRows > 0) {
        inserted++;
        console.log(`[Migration 004]   + Inserted: "${role.role_name}"`);
      } else {
        skipped++;
        console.log(`[Migration 004]   ~ Preserved/Skipped: "${role.role_name}"`);
      }
    }

    console.log(
      `[Migration 004] Completed. ${inserted} role(s) inserted, ${skipped} role(s) already existed.`
    );
  } finally {
    connection.release();
  }
};

// Auto-run if executed directly
if (process.argv[1]?.endsWith('004_expand_role_catalog.js')) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[Migration 004 Error]:', err);
      process.exit(1);
    });
}

