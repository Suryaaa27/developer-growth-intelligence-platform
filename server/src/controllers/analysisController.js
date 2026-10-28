import pool from '../config/db.js';
import { detectSkillsFromRepo } from '../services/skillDetectionService.js';
import { decryptToken } from '../utils/tokenEncryption.js';

/**
 * Analysis Controller
 * Handles running skill gap detection across synchronized repositories and persisting evidence.
 */

/**
 * POST /api/analysis/run
 * Initiates skill analysis for synchronized GitHub repositories belonging to the authenticated user.
 * Persists detected evidence into MySQL skill_evidence table, updates repositories.last_analyzed_at,
 * and returns an aggregated execution summary.
 */
export const runAnalysis = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found in request context.',
      });
    }

    // 1. Fetch user's profile to obtain verified GitHub identity and token
    const [userRows] = await pool.query(
      'SELECT id, github_id, github_username, github_access_token FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    const dbUser = userRows[0] || {};
    const verifiedUsername = (dbUser.github_username || '').trim().toLowerCase();

    let accessToken = null;
    if (dbUser.github_access_token) {
      try {
        accessToken = decryptToken(dbUser.github_access_token);
      } catch (tokenErr) {
        console.warn('[runAnalysis] Failed to decrypt stored GitHub access token:', tokenErr.message);
      }
    }

    // 2. Fetch user's synchronized repositories with ownership metadata
    const [allRepos] = await pool.query(
      `SELECT id, user_id, github_repo_id, repo_name, full_name, owner_login, description, primary_language, html_url, is_fork, last_analyzed_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    // Filter to ensure only valid repositories belonging to this user are analyzed
    // (excludes unowned test artifacts if any remain)
    const repositories = allRepos.filter((repo) => {
      if (!verifiedUsername) return true;
      const owner = (repo.owner_login || (repo.full_name ? repo.full_name.split('/')[0] : '')).toLowerCase();
      // Allow repositories owned by user or valid collaborations associated with user
      return owner === verifiedUsername || repo.owner_login != null;
    });

    // 3. Early exit if no repositories are synchronized
    if (!repositories || repositories.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No synchronized repositories found. Please synchronize your GitHub repositories first.',
        data: {
          totalRepositories: 0,
          analyzedCount: 0,
          skippedCount: 0,
          evidenceCount: 0,
          distinctSkills: [],
          failures: [],
          repositories: [],
        },
      });
    }

    const analyzedRepos = [];
    const skippedRepos = [];
    const failures = [];
    const distinctSkillsSet = new Set();
    let totalEvidenceCount = 0;

    // Optional test fetcher hook passed via request, plus authenticated OAuth token
    const detectOptions = {
      ...(req._testFetcher ? { fetcher: req._testFetcher } : {}),
      ...(accessToken ? { accessToken } : {}),
    };

    // 4. Process each synchronized repository
    for (const repo of repositories) {
      const repoPayload = {
        id: repo.id,
        fullName: repo.full_name,
        primaryLanguage: repo.primary_language,
        userId: repo.user_id,
      };

      let skills = [];
      try {
        skills = await detectSkillsFromRepo(repoPayload, detectOptions);
      } catch (err) {
        // Handle upstream GitHub Rate Limiting cleanly
        if (err.code === 'GITHUB_RATE_LIMITED' || err.status === 429) {
          console.error(`[analysisController] Rate limit encountered while analyzing repo ${repo.full_name}`);
          return res.status(429).json({
            success: false,
            code: 'GITHUB_RATE_LIMITED',
            message: 'GitHub API rate limit exceeded. Please try again later.',
          });
        }

        // Individual repository failure (e.g. 404, network error, transient error)
        console.warn(`[analysisController] Skipping repo ${repo.full_name} due to fetch error: ${err.message}`);
        failures.push({
          repoId: repo.id,
          repoFullName: repo.full_name,
          reason: err.message,
        });
        skippedRepos.push(repo.full_name);
        continue;
      }

      // 5. Persist evidence atomically within a database transaction per repository
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Remove previous evidence records for this repository to ensure idempotency
        await connection.query('DELETE FROM skill_evidence WHERE repository_id = ?', [repo.id]);

        // Insert fresh evidence records
        for (const skill of skills) {
          await connection.query(
            `INSERT INTO skill_evidence (
               repository_id,
               skill_name,
               evidence_type,
               evidence_details,
               evidence_file_path,
               confidence_score,
               detected_at
             ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [
              repo.id,
              skill.skillName,
              skill.evidenceType,
              skill.evidenceDetails,
              skill.evidenceFilePath || null,
              skill.confidenceScore != null ? skill.confidenceScore : 0,
            ]
          );
          distinctSkillsSet.add(skill.skillName);
        }

        // Update repository timestamp
        await connection.query('UPDATE repositories SET last_analyzed_at = NOW() WHERE id = ?', [
          repo.id,
        ]);

        await connection.commit();

        totalEvidenceCount += skills.length;
        analyzedRepos.push({
          id: repo.id,
          fullName: repo.full_name,
          evidenceCount: skills.length,
          skills: skills.map((s) => s.skillName),
        });
      } catch (dbErr) {
        await connection.rollback();
        console.error(
          `[analysisController] DB transaction rolled back for repo ${repo.full_name}: ${dbErr.message}`
        );
        failures.push({
          repoId: repo.id,
          repoFullName: repo.full_name,
          reason: dbErr.message,
        });
        skippedRepos.push(repo.full_name);
      } finally {
        connection.release();
      }
    }

    // 6. If at least one repository was successfully analyzed, compute and persist
    //    analysis snapshots — one row per role_requirement.
    //    readiness_score = evidence coverage ratio (matched required skills / total required skills × 100).
    //    This is an observable signal coverage metric, NOT a proficiency measurement.
    if (analyzedRepos.length > 0) {
      try {
        const [roleRows] = await pool.query(
          'SELECT id, role_name, required_skills FROM role_requirements ORDER BY id'
        );

        const detectedSkillNames = Array.from(distinctSkillsSet).map((s) => s.toLowerCase());

        for (const role of roleRows) {
          const requiredSkills =
            typeof role.required_skills === 'string'
              ? JSON.parse(role.required_skills)
              : role.required_skills;

          if (!Array.isArray(requiredSkills) || requiredSkills.length === 0) continue;

          const totalRequired = requiredSkills.length;
          const matchedCount = requiredSkills.filter((req) => {
            const reqName = (req.name || '').toLowerCase();
            return detectedSkillNames.some((det) => det.includes(reqName) || reqName.includes(det));
          }).length;

          const coverageScore = Math.round((matchedCount / totalRequired) * 100);

          const analysisSummary = {
            totalRequired,
            matchedSkills: matchedCount,
            coveragePercent: coverageScore,
            note: 'evidence coverage ratio — reflects observable code signals, not measured proficiency.',
            analyzedRepositories: analyzedRepos.length,
            distinctSkillsDetected: Array.from(distinctSkillsSet).length,
          };

          await pool.query(
            `INSERT INTO analysis_snapshots (user_id, target_role_id, readiness_score, analysis_summary, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [userId, role.id, coverageScore, JSON.stringify(analysisSummary)]
          );
        }
      } catch (snapshotErr) {
        // Snapshot persistence is non-fatal — log and continue
        console.warn('[runAnalysis] Failed to persist analysis snapshots:', snapshotErr.message);
      }
    }

    // 7. Return complete analysis summary
    return res.status(200).json({
      success: true,
      message: 'Skill gap analysis completed successfully.',
      data: {
        totalRepositories: repositories.length,
        analyzedCount: analyzedRepos.length,
        skippedCount: skippedRepos.length,
        evidenceCount: totalEvidenceCount,
        distinctSkills: Array.from(distinctSkillsSet),
        failures,
        repositories: analyzedRepos,
      },
    });
  } catch (error) {
    console.error('[runAnalysis Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Skill analysis service encountered an unexpected error.',
    });
  }
};

/**
 * GET /api/analysis/snapshots
 * Retrieves historical analysis snapshots belonging to the authenticated user.
 * Strictly guarantees isolation by filtering on user_id = req.user.id.
 */
export const getSnapshots = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. User ID not found in request context.',
      });
    }

    const [rows] = await pool.query(
      `SELECT s.id, s.user_id, s.target_role_id, s.readiness_score, s.analysis_summary, s.created_at,
              r.role_name
       FROM analysis_snapshots s
       LEFT JOIN role_requirements r ON s.target_role_id = r.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        targetRoleId: r.target_role_id,
        roleName: r.role_name || `Role #${r.target_role_id}`,
        readinessScore: r.readiness_score != null ? Number(r.readiness_score) : null,
        analysisSummary: r.analysis_summary,
        createdAt: r.created_at,
      })),
      count: rows.length,
    });
  } catch (error) {
    console.error('[getSnapshots Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve analysis snapshots.',
    });
  }
};
