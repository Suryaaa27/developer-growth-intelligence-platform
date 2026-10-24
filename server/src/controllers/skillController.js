import pool from '../config/db.js';
import { LANGUAGE_SKILL_MAP } from '../analyzers/languageAnalyzer.js';
import { NPM_SKILL_MAP, MAVEN_SKILL_MAP } from '../analyzers/dependencyAnalyzer.js';
import { FILE_EVIDENCE_MAP } from '../analyzers/fileEvidenceAnalyzer.js';

/**
 * Skill Controller
 * Handles querying aggregated skills and granular skill evidence for the authenticated user.
 */

// Scoring constants matching skillDetectionService
const MAX_AGGREGATED = 95;
const CROSS_REPO_BONUS = 3;

/**
 * Resolves the functional category for a given skillName and evidenceType.
 *
 * @param {string} skillName
 * @param {string} [evidenceType]
 * @returns {'Language' | 'Framework' | 'Database' | 'Tool' | 'Architecture'}
 */
export const resolveSkillCategory = (skillName, evidenceType) => {
  if (evidenceType === 'language_bytes') return 'Language';

  const lowerName = String(skillName).toLowerCase();

  for (const dep of Object.values(NPM_SKILL_MAP)) {
    if (dep.skillName.toLowerCase() === lowerName) return dep.category;
  }
  for (const dep of Object.values(MAVEN_SKILL_MAP)) {
    if (dep.skillName.toLowerCase() === lowerName) return dep.category;
  }
  for (const item of FILE_EVIDENCE_MAP) {
    if (item.skillName.toLowerCase() === lowerName) return item.category;
  }
  for (const lang of Object.values(LANGUAGE_SKILL_MAP)) {
    if (lang.toLowerCase() === lowerName) return 'Language';
  }

  return 'Tool';
};

/**
 * Select the primary evidence type based on priority order:
 * language_bytes > dependency > config_file
 */
const pickPrimaryEvidenceType = (types) => {
  const priority = ['language_bytes', 'dependency', 'config_file'];
  const sorted = types
    .slice()
    .sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
    });
  return sorted[0] || types[0] || 'dependency';
};

/**
 * GET /api/skills
 * Retrieves all aggregated skills belonging to the authenticated user across their synchronized repositories.
 * Strictly queries the database and guarantees isolation by filtering on repositories.user_id = req.user.id.
 */
export const getUserSkills = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found in request context.',
      });
    }

    const [rows] = await pool.query(
      `SELECT 
         se.id,
         se.repository_id,
         se.skill_name,
         se.evidence_type,
         se.evidence_details,
         se.evidence_file_path,
         se.confidence_score,
         se.detected_at,
         r.id AS repo_id,
         r.repo_name,
         r.full_name AS repo_full_name
       FROM skill_evidence se
       JOIN repositories r ON se.repository_id = r.id
       WHERE r.user_id = ?
       ORDER BY se.confidence_score DESC, se.detected_at DESC`,
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        skills: [],
        count: 0,
      });
    }

    // Group database rows by skill_name
    const skillMap = new Map();

    for (const row of rows) {
      const canonicalName = row.skill_name;
      const existing = skillMap.get(canonicalName);

      const repoInfo = {
        id: row.repo_id,
        repoName: row.repo_name,
        fullName: row.repo_full_name,
      };

      if (!existing) {
        skillMap.set(canonicalName, {
          skillName: canonicalName,
          evidenceTypes: [row.evidence_type],
          scores: [Number(row.confidence_score) || 0],
          repositories: [repoInfo],
          repoIds: new Set([row.repo_id]),
          repoNames: [row.repo_full_name],
          lastDetectedAt: row.detected_at,
        });
      } else {
        existing.evidenceTypes.push(row.evidence_type);
        existing.scores.push(Number(row.confidence_score) || 0);

        if (!existing.repoIds.has(row.repo_id)) {
          existing.repoIds.add(row.repo_id);
          existing.repositories.push(repoInfo);
          existing.repoNames.push(row.repo_full_name);
        }

        if (new Date(row.detected_at) > new Date(existing.lastDetectedAt)) {
          existing.lastDetectedAt = row.detected_at;
        }
      }
    }

    // Aggregate metrics for each distinct skill
    const aggregatedSkills = Array.from(skillMap.values()).map((s) => {
      const repoCount = s.repoIds.size;
      const bestScore = Math.max(...s.scores);
      const aggregatedConfidence = Math.min(
        MAX_AGGREGATED,
        Math.round(bestScore + CROSS_REPO_BONUS * (repoCount - 1))
      );
      const primaryEvidenceType = pickPrimaryEvidenceType(s.evidenceTypes);
      const category = resolveSkillCategory(s.skillName, primaryEvidenceType);

      return {
        skillName: s.skillName,
        category,
        confidenceScore: aggregatedConfidence,
        evidenceType: primaryEvidenceType,
        repositoryCount: repoCount,
        contributingRepositories: s.repoNames,
        repositories: s.repositories,
        lastDetectedAt: s.lastDetectedAt,
      };
    });

    // Sort by confidenceScore descending
    aggregatedSkills.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return res.status(200).json({
      success: true,
      data: aggregatedSkills,
      skills: aggregatedSkills,
      count: aggregatedSkills.length,
    });
  } catch (error) {
    console.error('[getUserSkills Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve skills from database.',
    });
  }
};

/**
 * GET /api/skills/:skillName
 * Retrieves the granular evidence records for a single skill for the authenticated user.
 * Returns 404 if no evidence exists for this user, strictly preventing cross-user leakage.
 */
export const getSkillEvidence = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found in request context.',
      });
    }

    const rawSkillName = req.params?.skillName;
    if (!rawSkillName || typeof rawSkillName !== 'string' || !rawSkillName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A valid skill name is required.',
      });
    }

    const cleanSkillName = rawSkillName.trim();
    if (cleanSkillName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Skill name exceeds maximum length of 100 characters.',
      });
    }

    // Query MySQL skill_evidence joined to repositories with strict user ownership filter
    const [rows] = await pool.query(
      `SELECT 
         se.id,
         se.repository_id,
         se.skill_name,
         se.evidence_type,
         se.evidence_details,
         se.evidence_file_path,
         se.confidence_score,
         se.detected_at,
         r.id AS repo_id,
         r.repo_name,
         r.full_name AS repo_full_name
       FROM skill_evidence se
       JOIN repositories r ON se.repository_id = r.id
       WHERE r.user_id = ? AND LOWER(se.skill_name) = LOWER(?)
       ORDER BY se.confidence_score DESC, se.detected_at DESC`,
      [userId, cleanSkillName]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No evidence found for skill '${cleanSkillName}' for the current user.`,
      });
    }

    const canonicalSkillName = rows[0].skill_name;
    const repoIdSet = new Set(rows.map((r) => r.repo_id));
    const repoCount = repoIdSet.size;
    const scores = rows.map((r) => Number(r.confidence_score) || 0);
    const bestScore = Math.max(...scores);
    const aggregatedConfidence = Math.min(
      MAX_AGGREGATED,
      Math.round(bestScore + CROSS_REPO_BONUS * (repoCount - 1))
    );

    const primaryType = pickPrimaryEvidenceType(rows.map((r) => r.evidence_type));
    const category = resolveSkillCategory(canonicalSkillName, primaryType);

    const evidenceRecords = rows.map((r) => ({
      id: r.id,
      repositoryId: r.repository_id,
      repoId: r.repo_id,
      repoName: r.repo_name,
      repositoryName: r.repo_name,
      fullName: r.repo_full_name,
      repositoryFullName: r.repo_full_name,
      evidenceType: r.evidence_type,
      evidenceDetails: r.evidence_details,
      evidenceFilePath: r.evidence_file_path,
      confidenceScore: Number(r.confidence_score) || 0,
      detectedAt: r.detected_at,
    }));

    return res.status(200).json({
      success: true,
      data: {
        skillName: canonicalSkillName,
        category,
        confidenceScore: aggregatedConfidence,
        repositoryCount: repoCount,
        evidence: evidenceRecords,
      },
    });
  } catch (error) {
    console.error('[getSkillEvidence Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve skill evidence from database.',
    });
  }
};
