/**
 * Skill Matcher Utility
 *
 * Compares required skills defined on engineering job roles against
 * skill evidence detected from GitHub repositories.
 *
 * Key Design Principles:
 * 1. Case-insensitive and trimmed normalization.
 * 2. Parenthetical qualification stripping (e.g. 'Jenkins (CI/CD)' matches
 *    both 'Jenkins' and 'CI/CD'; 'MongoDB (Mongoose)' matches 'MongoDB').
 * 3. Short-token guard: Short skill names (<= 2 characters such as 'C', 'R', 'Go')
 *    MUST match as exact standalone words or tokens, never as arbitrary substrings
 *    of unrelated words (preventing 'C' from matching 'JavaScript' or 'Docker').
 * 4. Multi-part / alias resolution: handles compound definitions like 'PyTorch / TensorFlow'
 *    or 'C#/.NET' by evaluating individual alternatives.
 * 5. Safe and conservative: only confirmed signals count as evidence matches.
 */

const normalize = (str) => (str || '').toLowerCase().trim();

/**
 * Tokenize a skill string into alphanumeric components.
 * e.g., "Jenkins (CI/CD)" -> ["jenkins", "ci", "cd"]
 */
const tokenize = (str) =>
  normalize(str)
    .split(/[\s,()/:&+-]+/)
    .filter(Boolean);

/**
 * Checks whether a single required skill matches a single detected skill name.
 *
 * @param {string} reqName - Required skill name (e.g. "Docker", "C#", "CI/CD")
 * @param {string} detName - Detected skill name (e.g. "Docker Compose", "GitHub Actions (CI/CD)")
 * @returns {boolean}
 */
export const isSkillMatch = (reqName, detName) => {
  if (!reqName || !detName) return false;

  const rNorm = normalize(reqName);
  const dNorm = normalize(detName);

  // Exact match
  if (rNorm === dNorm) return true;

  // Strict disambiguation: 'Java' must NEVER match 'JavaScript' or 'TypeScript'
  if (rNorm === 'java' && (dNorm === 'javascript' || dNorm.includes('javascript'))) {
    return false;
  }
  if (dNorm === 'java' && (rNorm === 'javascript' || rNorm.includes('javascript'))) {
    return false;
  }

  // Strip parentheticals from detected: 'Jest (Testing)' -> 'jest'
  const dBase = normalize(detName.replace(/\([^)]*\)/g, ''));
  if (dBase && dBase === rNorm) return true;

  const dTokens = tokenize(detName);
  const rTokens = tokenize(reqName);

  // Short identifiers (<= 2 characters: 'C', 'R', 'Go') require exact token match
  if (rNorm.length <= 2) {
    return dTokens.includes(rNorm);
  }

  // Check compound requirement alternatives (e.g. 'PyTorch / TensorFlow', 'C#/.NET')
  if (reqName.includes('/') || reqName.includes('&')) {
    const parts = reqName.split(/[/&]/).map((p) => normalize(p).trim()).filter(Boolean);
    for (const part of parts) {
      if (part.length <= 2) {
        if (dTokens.includes(part)) return true;
      } else if (dNorm.includes(part) || (dBase && dBase.includes(part))) {
        if (part === 'java' && (dNorm === 'javascript' || dNorm.includes('javascript'))) continue;
        return true;
      }
    }
  }

  // Direct substring containment for longer terms (>= 3 chars)
  // e.g. req 'Docker' in det 'Docker Compose', or req 'React' in det 'React Testing Library'
  if (dNorm.includes(rNorm)) {
    return true;
  }

  // Base string containment
  if (rNorm.length >= 4 && dBase && dBase.includes(rNorm)) {
    return true;
  }

  // If detected is part of required (e.g. req 'REST APIs' matching det 'REST', or req 'PostgreSQL Database' matching det 'PostgreSQL')
  if (dNorm.length >= 4 && rNorm.includes(dNorm)) {
    return true;
  }

  return false;
};

/**
 * Evaluates whether a required skill is satisfied by ANY detected skill in the list.
 *
 * @param {string|{name: string}} requiredSkill - Skill name or required skill object
 * @param {Array<string|{skillName: string}>} detectedSkills - List of detected skill names or objects
 * @returns {boolean}
 */
export const checkRequiredSkillSatisfied = (requiredSkill, detectedSkills) => {
  if (!requiredSkill || !Array.isArray(detectedSkills) || detectedSkills.length === 0) {
    return false;
  }

  const reqName = typeof requiredSkill === 'string' ? requiredSkill : requiredSkill?.name;
  if (!reqName) return false;

  return detectedSkills.some((det) => {
    const detName = typeof det === 'string' ? det : det?.skillName;
    return isSkillMatch(reqName, detName);
  });
};

/**
 * Evaluates a role's required skills against detected skills.
 *
 * @param {Array<{name: string, category?: string, benchmarkScore?: number}>} requiredSkills
 * @param {Array<string|{skillName: string}>} detectedSkills
 * @returns {{
 *   totalRequired: number,
 *   matchedCount: number,
 *   coverageScore: number,
 *   matchedSkills: string[],
 *   missingSkills: string[]
 * }}
 */
export const evaluateRoleCoverage = (requiredSkills, detectedSkills) => {
  const reqList = Array.isArray(requiredSkills) ? requiredSkills : [];
  const detList = Array.isArray(detectedSkills) ? detectedSkills : [];

  const matchedSkills = [];
  const missingSkills = [];

  for (const req of reqList) {
    const reqName = typeof req === 'string' ? req : req.name;
    if (!reqName) continue;

    if (checkRequiredSkillSatisfied(reqName, detList)) {
      matchedSkills.push(reqName);
    } else {
      missingSkills.push(reqName);
    }
  }

  const totalRequired = reqList.length;
  const matchedCount = matchedSkills.length;
  const coverageScore = totalRequired > 0 ? Math.round((matchedCount / totalRequired) * 100) : 0;

  return {
    totalRequired,
    matchedCount,
    coverageScore,
    matchedSkills,
    missingSkills,
  };
};

