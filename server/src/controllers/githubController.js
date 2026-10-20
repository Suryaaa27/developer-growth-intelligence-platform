import pool from '../config/db.js';
import { fetchUserRepos } from '../services/githubService.js';

/**
 * GitHub Controller
 * Handles fetching, persisting, and querying user-synchronized GitHub repository data.
 */

/**
 * GET /api/github/repos
 * Retrieves all synchronized GitHub repositories belonging to the currently authenticated user.
 */
export const getRepos = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url, last_analyzed_at, created_at, updated_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        repositories: rows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          githubRepoId: String(r.github_repo_id),
          repoName: r.repo_name,
          fullName: r.full_name,
          description: r.description,
          primaryLanguage: r.primary_language,
          htmlUrl: r.html_url,
          lastAnalyzedAt: r.last_analyzed_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        count: rows.length,
      },
    });
  } catch (error) {
    console.error('[getRepos Controller Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve repositories from database.',
    });
  }
};

/**
 * POST /api/github/sync
 * Fetches public repositories for a specified GitHub username and synchronizes them
 * into the database under the authenticated user's ID.
 *
 * Body: { githubUsername: string }
 */
export const syncRepos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { githubUsername } = req.body || {};

    // 1. Validate username presence and type
    if (!githubUsername || typeof githubUsername !== 'string' || !githubUsername.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A GitHub username is required to synchronize repositories.',
      });
    }

    const trimmedUsername = githubUsername.trim();

    // 2. Validate GitHub username format: alphanumeric + single hyphens, 1-39 chars, no start/end hyphen
    const githubUsernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    if (!githubUsernameRegex.test(trimmedUsername)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GitHub username format. Usernames can only contain alphanumeric characters and single hyphens, and cannot begin or end with a hyphen.',
      });
    }

    // 3. Fetch public repositories from GitHub
    let fetchedRepos;
    try {
      fetchedRepos = await fetchUserRepos(trimmedUsername);
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({
          success: false,
          message: `GitHub user '${trimmedUsername}' was not found.`,
        });
      }
      if (err.status === 429) {
        return res.status(429).json({
          success: false,
          message: 'GitHub API rate limit exceeded. Please try again later.',
        });
      }
      if (err.status === 504) {
        return res.status(504).json({
          success: false,
          message: 'GitHub API request timed out. Please try again later.',
        });
      }
      return res.status(err.status || 502).json({
        success: false,
        message: err.message || 'Failed to fetch repositories from GitHub.',
      });
    }

    // 4. Handle empty public repositories list
    if (!fetchedRepos || fetchedRepos.length === 0) {
      return res.status(200).json({
        success: true,
        message: `GitHub user '${trimmedUsername}' has no public repositories.`,
        data: {
          repositories: [],
          count: 0,
          syncedCount: 0,
        },
      });
    }

    // 5. Upsert repositories into MySQL database within a transaction
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const upsertSql = `
        INSERT INTO repositories (
          user_id,
          github_repo_id,
          repo_name,
          full_name,
          description,
          primary_language,
          html_url,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          repo_name = VALUES(repo_name),
          full_name = VALUES(full_name),
          description = VALUES(description),
          primary_language = VALUES(primary_language),
          html_url = VALUES(html_url),
          updated_at = NOW()
      `;

      for (const repo of fetchedRepos) {
        await connection.query(upsertSql, [
          userId,
          repo.githubRepoId,
          repo.name ? repo.name.slice(0, 191) : 'unnamed-repo',
          repo.fullName ? repo.fullName.slice(0, 191) : 'unknown/repo',
          repo.description || null,
          repo.primaryLanguage ? repo.primaryLanguage.slice(0, 60) : null,
          repo.htmlUrl ? repo.htmlUrl.slice(0, 255) : '',
        ]);
      }

      await connection.commit();
    } catch (dbError) {
      await connection.rollback();
      throw dbError;
    } finally {
      connection.release();
    }

    // 6. Fetch the updated full repository list for the user
    const [userRepos] = await pool.query(
      `SELECT id, user_id, github_repo_id, repo_name, full_name, description, primary_language, html_url, last_analyzed_at, created_at, updated_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${fetchedRepos.length} public repositories from @${trimmedUsername}.`,
      data: {
        repositories: userRepos.map((r) => ({
          id: r.id,
          userId: r.user_id,
          githubRepoId: String(r.github_repo_id),
          repoName: r.repo_name,
          fullName: r.full_name,
          description: r.description,
          primaryLanguage: r.primary_language,
          htmlUrl: r.html_url,
          lastAnalyzedAt: r.last_analyzed_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        count: userRepos.length,
        syncedCount: fetchedRepos.length,
      },
    });
  } catch (error) {
    console.error('[syncRepos Controller Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to synchronize repositories due to an internal server error.',
    });
  }
};
