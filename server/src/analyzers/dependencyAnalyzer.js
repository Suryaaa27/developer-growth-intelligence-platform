/**
 * Dependency Analyzer
 *
 * Reads package manifests (currently package.json and pom.xml) and maps
 * known dependency identifiers to normalized skill-evidence records.
 *
 * SUPPORTED MANIFEST TYPES
 * ─────────────────────────
 * • package.json  — Node.js / JavaScript / TypeScript projects
 * • pom.xml       — Java Maven projects
 *
 * CONFIDENCE SEMANTICS
 * ─────────────────────
 * `confidenceScore` (0–100) describes *evidence of intentional use*, not proficiency:
 *
 * • 70  — Dependency found in `dependencies` (production use inferred)
 * • 50  — Dependency found only in `devDependencies` (tooling / build use)
 * • 60  — Maven compile/runtime scope (production use)
 * • 40  — Maven test scope (test-only tooling)
 *
 * Ceilings are deliberately conservative. Presence in a manifest confirms the
 * developer chose a technology; it does not validate how it is used.
 *
 * SIZE GUARD
 * ───────────
 * Files larger than MAX_MANIFEST_BYTES are skipped. This prevents OOM issues
 * if an adversarially crafted or auto-generated manifest is encountered.
 */

const MAX_MANIFEST_BYTES = 500_000; // 500 KB

// ─── package.json Dependency → Skill Map ─────────────────────────────────────
//
// Keyed by the exact npm package name. Value is { skillName, category }.
// category must be one of: 'Language', 'Framework', 'Database', 'Tool', 'Architecture'
//
// Ordering within this map has no significance. Add new entries alphabetically.

export const NPM_SKILL_MAP = {
  // ── Runtimes / Language
  typescript: { skillName: 'TypeScript', category: 'Language' },

  // ── Frameworks / Libraries
  '@angular/core': { skillName: 'Angular', category: 'Framework' },
  '@nestjs/core': { skillName: 'NestJS', category: 'Framework' },
  '@sveltejs/kit': { skillName: 'SvelteKit', category: 'Framework' },
  express: { skillName: 'Express.js', category: 'Framework' },
  fastify: { skillName: 'Fastify', category: 'Framework' },
  hapi: { skillName: 'Hapi.js', category: 'Framework' },
  koa: { skillName: 'Koa.js', category: 'Framework' },
  next: { skillName: 'Next.js', category: 'Framework' },
  nuxt: { skillName: 'Nuxt.js', category: 'Framework' },
  react: { skillName: 'React', category: 'Framework' },
  'react-dom': { skillName: 'React', category: 'Framework' },
  'react-native': { skillName: 'React Native', category: 'Framework' },
  svelte: { skillName: 'Svelte', category: 'Framework' },
  vue: { skillName: 'Vue.js', category: 'Framework' },

  // ── Databases / ORMs / Clients
  '@prisma/client': { skillName: 'Prisma ORM', category: 'Database' },
  knex: { skillName: 'Knex.js (SQL)', category: 'Database' },
  mongoose: { skillName: 'MongoDB (Mongoose)', category: 'Database' },
  mysql2: { skillName: 'MySQL', category: 'Database' },
  pg: { skillName: 'PostgreSQL', category: 'Database' },
  redis: { skillName: 'Redis', category: 'Database' },
  sequelize: { skillName: 'Sequelize ORM', category: 'Database' },
  typeorm: { skillName: 'TypeORM', category: 'Database' },

  // ── Testing
  '@jest/core': { skillName: 'Jest (Testing)', category: 'Tool' },
  '@playwright/test': { skillName: 'Playwright (E2E Testing)', category: 'Tool' },
  '@testing-library/react': { skillName: 'React Testing Library', category: 'Tool' },
  '@vitest/core': { skillName: 'Vitest (Testing)', category: 'Tool' },
  chai: { skillName: 'Chai (Testing)', category: 'Tool' },
  cypress: { skillName: 'Cypress (E2E Testing)', category: 'Tool' },
  jest: { skillName: 'Jest (Testing)', category: 'Tool' },
  mocha: { skillName: 'Mocha (Testing)', category: 'Tool' },
  vitest: { skillName: 'Vitest (Testing)', category: 'Tool' },

  // ── Build / Bundling
  vite: { skillName: 'Vite', category: 'Tool' },
  webpack: { skillName: 'Webpack', category: 'Tool' },
  rollup: { skillName: 'Rollup', category: 'Tool' },
  esbuild: { skillName: 'esbuild', category: 'Tool' },
  parcel: { skillName: 'Parcel', category: 'Tool' },
  turbo: { skillName: 'Turborepo', category: 'Tool' },

  // ── Auth / Security
  jsonwebtoken: { skillName: 'JWT Authentication', category: 'Architecture' },
  passport: { skillName: 'Passport.js (Auth)', category: 'Framework' },
  bcrypt: { skillName: 'bcrypt (Security)', category: 'Tool' },
  bcryptjs: { skillName: 'bcrypt (Security)', category: 'Tool' },

  // ── GraphQL
  graphql: { skillName: 'GraphQL', category: 'Architecture' },
  'apollo-server': { skillName: 'Apollo Server (GraphQL)', category: 'Framework' },
  '@apollo/client': { skillName: 'Apollo Client (GraphQL)', category: 'Framework' },

  // ── gRPC / Messaging
  grpc: { skillName: 'gRPC', category: 'Architecture' },
  amqplib: { skillName: 'RabbitMQ', category: 'Tool' },
  kafkajs: { skillName: 'Apache Kafka', category: 'Tool' },
  ioredis: { skillName: 'Redis', category: 'Database' },

  // ── Cloud / Infrastructure
  'aws-sdk': { skillName: 'AWS SDK', category: 'Tool' },
  '@aws-sdk/client-s3': { skillName: 'AWS S3', category: 'Tool' },
  'firebase-admin': { skillName: 'Firebase (Admin)', category: 'Tool' },
};

// ─── pom.xml Maven groupId:artifactId → Skill Map ────────────────────────────
//
// Key format: "groupId:artifactId" (exact match as they appear in <groupId> / <artifactId>).
// Partial group-level rules can be expressed by matching only groupId prefix patterns
// via the prefix entries at the bottom of this map.

export const MAVEN_SKILL_MAP = {
  // ── Spring ecosystem
  'org.springframework.boot:spring-boot-starter': { skillName: 'Spring Boot', category: 'Framework' },
  'org.springframework.boot:spring-boot-starter-web': { skillName: 'Spring Boot', category: 'Framework' },
  'org.springframework.boot:spring-boot-starter-data-jpa': { skillName: 'Spring Data JPA', category: 'Database' },
  'org.springframework.boot:spring-boot-starter-security': { skillName: 'Spring Security', category: 'Framework' },
  'org.springframework.boot:spring-boot-starter-test': { skillName: 'Spring Boot Test', category: 'Tool' },
  'org.springframework.boot:spring-boot-starter-validation': { skillName: 'Spring Validation', category: 'Framework' },
  'org.springframework.boot:spring-boot-starter-actuator': { skillName: 'Spring Actuator', category: 'Tool' },
  'org.springframework.cloud:spring-cloud-starter-gateway': { skillName: 'Spring Cloud Gateway', category: 'Architecture' },
  'org.springframework.kafka:spring-kafka': { skillName: 'Apache Kafka', category: 'Tool' },
  'org.springframework.amqp:spring-rabbit': { skillName: 'RabbitMQ', category: 'Tool' },

  // ── Databases / Persistence
  'com.h2database:h2': { skillName: 'H2 Database', category: 'Database' },
  'mysql:mysql-connector-java': { skillName: 'MySQL', category: 'Database' },
  'com.mysql:mysql-connector-j': { skillName: 'MySQL', category: 'Database' },
  'org.postgresql:postgresql': { skillName: 'PostgreSQL', category: 'Database' },
  'org.flywaydb:flyway-core': { skillName: 'Flyway (DB Migrations)', category: 'Tool' },
  'org.liquibase:liquibase-core': { skillName: 'Liquibase (DB Migrations)', category: 'Tool' },
  'org.hibernate:hibernate-core': { skillName: 'Hibernate ORM', category: 'Database' },
  'com.mongodb:mongodb-driver-sync': { skillName: 'MongoDB', category: 'Database' },
  'org.springframework.data:spring-data-mongodb': { skillName: 'MongoDB (Spring Data)', category: 'Database' },
  'io.lettuce:lettuce-core': { skillName: 'Redis', category: 'Database' },
  'redis.clients:jedis': { skillName: 'Redis', category: 'Database' },

  // ── JWT / Security
  'io.jsonwebtoken:jjwt-api': { skillName: 'JWT Authentication', category: 'Architecture' },
  'io.jsonwebtoken:jjwt': { skillName: 'JWT Authentication', category: 'Architecture' },

  // ── Testing
  'org.junit.jupiter:junit-jupiter': { skillName: 'JUnit 5', category: 'Tool' },
  'org.junit.jupiter:junit-jupiter-api': { skillName: 'JUnit 5', category: 'Tool' },
  'org.mockito:mockito-core': { skillName: 'Mockito', category: 'Tool' },
  'org.mockito:mockito-junit-jupiter': { skillName: 'Mockito', category: 'Tool' },
  'org.assertj:assertj-core': { skillName: 'AssertJ (Testing)', category: 'Tool' },
  'com.tngtech.archunit:archunit-junit5': { skillName: 'ArchUnit (Testing)', category: 'Tool' },

  // ── Messaging
  'org.apache.kafka:kafka-clients': { skillName: 'Apache Kafka', category: 'Tool' },
  'com.rabbitmq:amqp-client': { skillName: 'RabbitMQ', category: 'Tool' },

  // ── Cloud / Distributed
  'io.grpc:grpc-stub': { skillName: 'gRPC', category: 'Architecture' },
  'io.micrometer:micrometer-core': { skillName: 'Micrometer (Observability)', category: 'Tool' },

  // ── Utilities
  'org.projectlombok:lombok': { skillName: 'Lombok', category: 'Tool' },
  'com.google.guava:guava': { skillName: 'Guava', category: 'Tool' },
  'org.mapstruct:mapstruct': { skillName: 'MapStruct', category: 'Tool' },
  'com.fasterxml.jackson.core:jackson-databind': { skillName: 'Jackson (JSON)', category: 'Tool' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse a JSON string. Returns null on failure (does not throw).
 *
 * @param {string} content
 * @returns {object|null}
 */
const safeParseJson = (content) => {
  if (typeof content !== 'string') return null;
  if (content.length > MAX_MANIFEST_BYTES) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Deduplicate skill entries within a single manifest parse.
 * When the same skillName appears more than once, keep the one with the
 * higher confidence score.
 *
 * @param {Array<object>} evidenceList
 * @returns {Array<object>}
 */
const deduplicateBySkillName = (evidenceList) => {
  const map = new Map();
  for (const item of evidenceList) {
    const existing = map.get(item.skillName);
    if (!existing || item.confidenceScore > existing.confidenceScore) {
      map.set(item.skillName, item);
    }
  }
  return Array.from(map.values());
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a package.json string and return skill evidence records.
 *
 * Evidence from `dependencies` receives confidenceScore = 70 (production use inferred).
 * Evidence from `devDependencies` receives confidenceScore = 50 (build/tooling use).
 * When a package appears in both, the higher score (70) is kept.
 *
 * @param {string} packageJsonContent - Raw text of the package.json file.
 * @returns {Array<{
 *   skillName: string,
 *   category: string,
 *   confidenceScore: number,
 *   evidenceType: 'dependency',
 *   evidenceDetails: string,
 * }>} Empty array on parse failure or when no known packages are present.
 */
export const analyzePackageJson = (packageJsonContent) => {
  const parsed = safeParseJson(packageJsonContent);
  if (!parsed) return [];

  const results = [];

  const processSection = (deps, isProd) => {
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) return;
    const score = isProd ? 70 : 50;
    const scopeLabel = isProd ? 'production dependency' : 'devDependency';

    for (const [pkgName, version] of Object.entries(deps)) {
      const mapping = NPM_SKILL_MAP[pkgName];
      if (!mapping) continue;

      results.push({
        skillName: mapping.skillName,
        category: mapping.category,
        confidenceScore: score,
        evidenceType: 'dependency',
        evidenceDetails: `Found "${pkgName}@${version}" as a ${scopeLabel} in package.json.`,
      });
    }
  };

  processSection(parsed.dependencies, true);
  processSection(parsed.devDependencies, false);

  return deduplicateBySkillName(results);
};

/**
 * Parse a pom.xml string and return skill evidence records.
 *
 * Uses a lightweight text-based extractor (no full XML parser dependency) that
 * reads <groupId>, <artifactId>, and <scope> elements from <dependency> blocks.
 *
 * Evidence from compile/runtime/default scope receives confidenceScore = 60.
 * Evidence from test scope receives confidenceScore = 40.
 *
 * Malformed XML or blocks that cannot be parsed are skipped silently.
 *
 * @param {string} pomXmlContent - Raw text of the pom.xml file.
 * @returns {Array<{
 *   skillName: string,
 *   category: string,
 *   confidenceScore: number,
 *   evidenceType: 'dependency',
 *   evidenceDetails: string,
 * }>} Empty array on parse failure or no recognized dependencies.
 */
export const analyzePomXml = (pomXmlContent) => {
  if (typeof pomXmlContent !== 'string') return [];
  if (pomXmlContent.length > MAX_MANIFEST_BYTES) return [];

  const results = [];

  // Extract each <dependency>…</dependency> block (non-greedy, case-sensitive)
  const depBlockRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;

  let blockMatch;
  while ((blockMatch = depBlockRegex.exec(pomXmlContent)) !== null) {
    const block = blockMatch[1];
    const tags = {};

    let tagMatch;
    tagRegex.lastIndex = 0;
    while ((tagMatch = tagRegex.exec(block)) !== null) {
      tags[tagMatch[1].trim()] = tagMatch[2].trim();
    }

    const groupId = tags.groupId;
    const artifactId = tags.artifactId;
    const scope = (tags.scope || 'compile').toLowerCase();

    if (!groupId || !artifactId) continue;

    const key = `${groupId}:${artifactId}`;
    const mapping = MAVEN_SKILL_MAP[key];
    if (!mapping) continue;

    // test scope: lower confidence (confirms existence, not production use)
    const isTestScope = scope === 'test';
    const confidenceScore = isTestScope ? 40 : 60;

    results.push({
      skillName: mapping.skillName,
      category: mapping.category,
      confidenceScore,
      evidenceType: 'dependency',
      evidenceDetails: `Found Maven dependency "${key}" (scope: ${scope}) in pom.xml.`,
    });
  }

  return deduplicateBySkillName(results);
};
