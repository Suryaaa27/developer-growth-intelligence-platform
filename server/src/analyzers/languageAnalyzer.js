/**
 * Language Analyzer
 *
 * Converts GitHub's language byte-count map (from GET /repos/{owner}/{repo}/languages)
 * into normalized skill-evidence objects.
 *
 * CONFIDENCE SEMANTICS
 * --------------------
 * `confidenceScore` (0–100) describes the *strength of observable evidence*, NOT the
 * developer's proficiency level. A score of 90 means the language accounts for 90 %
 * of measurable source bytes in the repository — it does not assert expertise.
 *
 * Formula:
 *   share  = langBytes / totalBytes          (0.0 – 1.0)
 *   rawScore = share * 100
 *   confidenceScore = clamp(rawScore, MIN_CONFIDENCE, MAX_CONFIDENCE)
 *
 * A minimum floor of 10 is applied so every language returned by GitHub receives
 * at least a token evidence entry. The ceiling of 95 prevents any single language
 * from claiming a "perfect" evidence score (some bytes are always unclassified).
 */

const MIN_CONFIDENCE = 10;
const MAX_CONFIDENCE = 95;

/**
 * Maps GitHub's language name strings to the canonical skill names stored in
 * the skill_evidence table. Only languages listed here are emitted; unknown
 * GitHub languages are preserved verbatim as the skill name.
 *
 * To add a new language: add an entry below and document the source.
 * Source: https://github.com/github-linguist/linguist/blob/master/lib/linguist/languages.yml
 */
export const LANGUAGE_SKILL_MAP = {
  // Backend / General-purpose
  Java: 'Java',
  JavaScript: 'JavaScript',
  TypeScript: 'TypeScript',
  Python: 'Python',
  'C#': 'C#',
  Go: 'Go',
  Kotlin: 'Kotlin',
  Ruby: 'Ruby',
  PHP: 'PHP',
  Swift: 'Swift',
  Rust: 'Rust',
  Scala: 'Scala',
  Dart: 'Dart',
  'C++': 'C++',
  C: 'C',
  // Data / ML
  'Jupyter Notebook': 'Python (Jupyter)',
  R: 'R',
  // Web / Markup
  HTML: 'HTML',
  CSS: 'CSS',
  SCSS: 'CSS (SCSS)',
  // Shell / Scripting
  Shell: 'Shell Scripting',
  PowerShell: 'PowerShell',
  // Infrastructure / Config
  Dockerfile: 'Docker',
  HCL: 'Terraform (HCL)',
  Nix: 'Nix',
};

/**
 * Clamp a numeric value between min and max (inclusive).
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Convert a GitHub language byte-count map into skill evidence records.
 *
 * @param {object} languagesMap
 *   Raw object returned by GET /repos/{owner}/{repo}/languages.
 *   Keys are GitHub language names; values are integer byte counts.
 *   Example: { JavaScript: 15000, TypeScript: 5000 }
 *
 * @returns {Array<{
 *   skillName: string,
 *   category: 'Language',
 *   confidenceScore: number,
 *   evidenceType: 'language_bytes',
 *   evidenceDetails: string,
 * }>}
 *   Array of skill-evidence descriptors (does NOT include repositoryId — the
 *   caller is responsible for attaching that before persisting to the database).
 *   Returns an empty array when the input is falsy or contains no entries.
 */
export const analyzeLanguages = (languagesMap) => {
  // Defensive: null, undefined, or empty map
  if (!languagesMap || typeof languagesMap !== 'object' || Array.isArray(languagesMap)) {
    return [];
  }

  const entries = Object.entries(languagesMap);
  if (entries.length === 0) {
    return [];
  }

  // Calculate total bytes across all languages for share computation
  const totalBytes = entries.reduce((sum, [, bytes]) => {
    const b = typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : 0;
    return sum + b;
  }, 0);

  if (totalBytes === 0) {
    return [];
  }

  return entries
    .filter(([, bytes]) => typeof bytes === 'number' && Number.isFinite(bytes) && bytes > 0)
    .map(([githubLang, bytes]) => {
      const share = bytes / totalBytes;
      const rawScore = share * 100;
      const confidenceScore = Math.round(clamp(rawScore, MIN_CONFIDENCE, MAX_CONFIDENCE));

      // Use mapped canonical name if available; otherwise preserve the GitHub name verbatim
      const skillName = LANGUAGE_SKILL_MAP[githubLang] ?? githubLang;

      return {
        skillName,
        category: 'Language',
        confidenceScore,
        evidenceType: 'language_bytes',
        // Human-readable description stored as evidenceDetails in skill_evidence table
        evidenceDetails: `GitHub reports ${bytes.toLocaleString()} bytes of ${githubLang} `
          + `(${(share * 100).toFixed(1)}% of repository source).`,
      };
    });
};
