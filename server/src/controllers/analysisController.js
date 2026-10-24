import pool from '../config/db.js';
import { detectSkillsFromRepo } from '../services/skillDetectionService.js';

/**
 * Analysis Controller
 * Handles running skill gap detection across synchronized repositories and persisting evidence.
 */

/**
 * POST /api/analysis/run
 * Initiates skill analysis for all synchronized GitHub repositories belonging to the authenticated user.
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

    // 1. Fetch user's synchronized repositories
    const [repositories] = await pool.query(
      `SELECT id, user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url, last_analyzed_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    // 2. Early exit if no repositories are synchronized
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

    // Optional test fetcher hook passed via request
    const detectOptions = req._testFetcher ? { fetcher: req._testFetcher } : {};

    // 3. Process each synchronized repository
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

      // 4. Persist evidence atomically within a database transaction per repository
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

    // 5. Return complete analysis summary
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
