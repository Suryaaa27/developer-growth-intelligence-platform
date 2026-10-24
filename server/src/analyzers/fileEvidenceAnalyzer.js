/**
 * File Evidence Analyzer
 *
 * Detects meaningful engineering practices by inspecting a repository's
 * top-level file tree — the list of file paths returned by the GitHub
 * Trees or Contents API.
 *
 * HOW IT WORKS
 * ─────────────
 * The caller passes an array of file path strings (e.g. the list of file
 * names in the repository root or a shallow tree). This module checks each
 * path against a curated FILE_EVIDENCE_MAP. It does NOT:
 *   • download or read file content
 *   • recursively expand directories
 *   • execute anything
 *
 * The allowed path list is an explicit allowlist defined in FILE_EVIDENCE_MAP.
 * Only paths in that map generate evidence entries.
 *
 * CONFIDENCE SEMANTICS
 * ─────────────────────
 * `confidenceScore` (0–100) is fixed per file pattern and describes the
 * *reliability of the inference*, not developer proficiency:
 *
 * • 80  — Strong inference: file's presence strongly implies intentional use
 *         (e.g. Dockerfile — you don't accidentally add one)
 * • 65  — Moderate inference: file is a standard config that may be
 *         auto-generated (e.g. docker-compose.yml)
 * • 50  — Indicative: file pattern suggests tooling awareness
 *
 * REPOSITORY CONTENT IS UNTRUSTED
 * ─────────────────────────────────
 * File paths are treated as opaque strings. No execution, no eval, and no
 * filesystem access is performed. Path values are only compared against the
 * allowlist using exact string matching or prefix checks.
 */

/**
 * Maps a file path pattern to a skill evidence descriptor.
 *
 * patternType:
 *   'exact'   — full path must equal pattern exactly (case-sensitive)
 *   'prefix'  — path must start with this string
 *   'suffix'  — path must end with this string (catches files in subdirs)
 *
 * To add new evidence: append an entry and document the inference rationale.
 */
export const FILE_EVIDENCE_MAP = [
  // ── Containerization ────────────────────────────────────────────────────────
  {
    pattern: 'Dockerfile',
    patternType: 'exact',
    skillName: 'Docker',
    category: 'Tool',
    confidenceScore: 80,
    label: 'Dockerfile',
  },
  {
    pattern: 'dockerfile',
    patternType: 'exact',
    skillName: 'Docker',
    category: 'Tool',
    confidenceScore: 80,
    label: 'Dockerfile (lowercase)',
  },
  {
    pattern: '.dockerfile',
    patternType: 'suffix',
    skillName: 'Docker',
    category: 'Tool',
    confidenceScore: 75,
    label: '*.dockerfile file',
  },
  {
    pattern: 'docker-compose.yml',
    patternType: 'exact',
    skillName: 'Docker Compose',
    category: 'Tool',
    confidenceScore: 75,
    label: 'docker-compose.yml',
  },
  {
    pattern: 'docker-compose.yaml',
    patternType: 'exact',
    skillName: 'Docker Compose',
    category: 'Tool',
    confidenceScore: 75,
    label: 'docker-compose.yaml',
  },

  // ── CI/CD ────────────────────────────────────────────────────────────────────
  {
    pattern: '.github/workflows/',
    patternType: 'prefix',
    skillName: 'GitHub Actions (CI/CD)',
    category: 'Tool',
    confidenceScore: 80,
    label: 'GitHub Actions workflow file',
  },
  {
    pattern: 'Jenkinsfile',
    patternType: 'exact',
    skillName: 'Jenkins (CI/CD)',
    category: 'Tool',
    confidenceScore: 80,
    label: 'Jenkinsfile',
  },
  {
    pattern: '.circleci/config.yml',
    patternType: 'exact',
    skillName: 'CircleCI (CI/CD)',
    category: 'Tool',
    confidenceScore: 80,
    label: '.circleci/config.yml',
  },
  {
    pattern: '.travis.yml',
    patternType: 'exact',
    skillName: 'Travis CI',
    category: 'Tool',
    confidenceScore: 80,
    label: '.travis.yml',
  },
  {
    pattern: 'bitbucket-pipelines.yml',
    patternType: 'exact',
    skillName: 'Bitbucket Pipelines (CI/CD)',
    category: 'Tool',
    confidenceScore: 80,
    label: 'bitbucket-pipelines.yml',
  },
  {
    pattern: 'azure-pipelines.yml',
    patternType: 'exact',
    skillName: 'Azure DevOps Pipelines',
    category: 'Tool',
    confidenceScore: 80,
    label: 'azure-pipelines.yml',
  },
  {
    pattern: '.gitlab-ci.yml',
    patternType: 'exact',
    skillName: 'GitLab CI/CD',
    category: 'Tool',
    confidenceScore: 80,
    label: '.gitlab-ci.yml',
  },

  // ── Infrastructure as Code ──────────────────────────────────────────────────
  {
    pattern: '.terraform',
    patternType: 'prefix',
    skillName: 'Terraform',
    category: 'Tool',
    confidenceScore: 80,
    label: '.terraform directory',
  },
  {
    pattern: '.tf',
    patternType: 'suffix',
    skillName: 'Terraform',
    category: 'Tool',
    confidenceScore: 75,
    label: '*.tf Terraform file',
  },
  {
    pattern: 'ansible.cfg',
    patternType: 'exact',
    skillName: 'Ansible',
    category: 'Tool',
    confidenceScore: 80,
    label: 'ansible.cfg',
  },
  {
    pattern: 'playbook.yml',
    patternType: 'exact',
    skillName: 'Ansible',
    category: 'Tool',
    confidenceScore: 75,
    label: 'playbook.yml',
  },
  {
    pattern: 'k8s/',
    patternType: 'prefix',
    skillName: 'Kubernetes',
    category: 'Tool',
    confidenceScore: 75,
    label: 'Kubernetes manifest directory',
  },
  {
    pattern: 'kubernetes/',
    patternType: 'prefix',
    skillName: 'Kubernetes',
    category: 'Tool',
    confidenceScore: 75,
    label: 'Kubernetes manifest directory',
  },
  {
    pattern: 'helm/',
    patternType: 'prefix',
    skillName: 'Helm (Kubernetes)',
    category: 'Tool',
    confidenceScore: 75,
    label: 'Helm chart directory',
  },

  // ── Spring Boot / Java ──────────────────────────────────────────────────────
  {
    pattern: 'src/main/resources/application.properties',
    patternType: 'exact',
    skillName: 'Spring Boot',
    category: 'Framework',
    confidenceScore: 75,
    label: 'application.properties',
  },
  {
    pattern: 'src/main/resources/application.yml',
    patternType: 'exact',
    skillName: 'Spring Boot',
    category: 'Framework',
    confidenceScore: 75,
    label: 'application.yml',
  },
  {
    pattern: 'src/main/resources/application.yaml',
    patternType: 'exact',
    skillName: 'Spring Boot',
    category: 'Framework',
    confidenceScore: 75,
    label: 'application.yaml',
  },

  // ── Python Project Indicators ────────────────────────────────────────────────
  {
    pattern: 'requirements.txt',
    patternType: 'exact',
    skillName: 'Python',
    category: 'Language',
    confidenceScore: 65,
    label: 'requirements.txt',
  },
  {
    pattern: 'Pipfile',
    patternType: 'exact',
    skillName: 'Python',
    category: 'Language',
    confidenceScore: 65,
    label: 'Pipfile',
  },
  {
    pattern: 'pyproject.toml',
    patternType: 'exact',
    skillName: 'Python',
    category: 'Language',
    confidenceScore: 65,
    label: 'pyproject.toml',
  },
  {
    pattern: 'setup.py',
    patternType: 'exact',
    skillName: 'Python',
    category: 'Language',
    confidenceScore: 65,
    label: 'setup.py',
  },

  // ── Testing Indicators ────────────────────────────────────────────────────
  {
    pattern: 'jest.config',
    patternType: 'prefix',
    skillName: 'Jest (Testing)',
    category: 'Tool',
    confidenceScore: 75,
    label: 'jest.config file',
  },
  {
    pattern: 'vitest.config',
    patternType: 'prefix',
    skillName: 'Vitest (Testing)',
    category: 'Tool',
    confidenceScore: 75,
    label: 'vitest.config file',
  },
  {
    pattern: 'cypress.config',
    patternType: 'prefix',
    skillName: 'Cypress (E2E Testing)',
    category: 'Tool',
    confidenceScore: 75,
    label: 'cypress.config file',
  },
  {
    pattern: 'playwright.config',
    patternType: 'prefix',
    skillName: 'Playwright (E2E Testing)',
    category: 'Tool',
    confidenceScore: 75,
    label: 'playwright.config file',
  },

  // ── TypeScript ───────────────────────────────────────────────────────────────
  {
    pattern: 'tsconfig.json',
    patternType: 'exact',
    skillName: 'TypeScript',
    category: 'Language',
    confidenceScore: 70,
    label: 'tsconfig.json',
  },

  // ── Code Quality ─────────────────────────────────────────────────────────────
  {
    pattern: '.eslintrc',
    patternType: 'prefix',
    skillName: 'ESLint (Code Quality)',
    category: 'Tool',
    confidenceScore: 50,
    label: 'ESLint configuration',
  },
  {
    pattern: '.prettierrc',
    patternType: 'prefix',
    skillName: 'Prettier (Code Formatting)',
    category: 'Tool',
    confidenceScore: 50,
    label: 'Prettier configuration',
  },
  {
    pattern: 'sonar-project.properties',
    patternType: 'exact',
    skillName: 'SonarQube (Code Quality)',
    category: 'Tool',
    confidenceScore: 65,
    label: 'sonar-project.properties',
  },
];

// ─── Matching helpers ─────────────────────────────────────────────────────────

/**
 * Check whether a file path matches a given evidence-map entry.
 *
 * @param {string} filePath   - A single path string from the repository tree
 * @param {{ pattern: string, patternType: string }} entry
 * @returns {boolean}
 */
const pathMatchesEntry = (filePath, entry) => {
  const { pattern, patternType } = entry;
  switch (patternType) {
    case 'exact':
      return filePath === pattern;
    case 'prefix':
      return filePath.startsWith(pattern);
    case 'suffix':
      return filePath.endsWith(pattern);
    default:
      return false;
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze an array of repository file paths and return skill evidence records
 * for any path that matches the FILE_EVIDENCE_MAP allowlist.
 *
 * @param {string[]} filePaths
 *   Array of file path strings from the repository tree.
 *   Example: ['Dockerfile', '.github/workflows/ci.yml', 'src/index.js']
 *
 * @returns {Array<{
 *   skillName: string,
 *   category: string,
 *   confidenceScore: number,
 *   evidenceType: 'config_file',
 *   evidenceDetails: string,
 * }>}
 *   Evidence records. Returns an empty array for empty/invalid input.
 *   When multiple files match the same skill, only the highest-confidence
 *   match is returned (deduplication applied).
 */
export const analyzeFileEvidence = (filePaths) => {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return [];
  }

  const rawResults = [];

  for (const filePath of filePaths) {
    // Treat repository content as untrusted: only compare strings, never execute
    if (typeof filePath !== 'string') continue;

    for (const entry of FILE_EVIDENCE_MAP) {
      if (pathMatchesEntry(filePath, entry)) {
        rawResults.push({
          skillName: entry.skillName,
          category: entry.category,
          confidenceScore: entry.confidenceScore,
          evidenceType: 'config_file',
          evidenceDetails: `Detected ${entry.label} at path "${filePath}" in repository.`,
        });
        // A single file may match at most one map entry; break inner loop
        break;
      }
    }
  }

  // Deduplicate: for the same skillName, keep the entry with the highest confidence
  const map = new Map();
  for (const item of rawResults) {
    const existing = map.get(item.skillName);
    if (!existing || item.confidenceScore > existing.confidenceScore) {
      map.set(item.skillName, item);
    }
  }

  return Array.from(map.values());
};
