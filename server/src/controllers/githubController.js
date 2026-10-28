import pool from '../config/db.js';
import { fetchUserRepos, fetchUserCollaborations } from '../services/githubService.js';
import { decryptToken } from '../utils/tokenEncryption.js';

/**
 * GitHub Controller
 * Handles fetching, persisting, and querying user-synchronized GitHub repository data
 * with strict backend ownership enforcement separating owned repositories from collaborations.
 */

/**
 * Formats a database repository record for client response.
 */
const formatRepoResponse = (r, isOwner) => ({
  id: r.id,
  userId: r.user_id,
  githubRepoId: String(r.github_repo_id),
  repoName: r.repo_name,
  fullName: r.full_name,
  ownerLogin: r.owner_login || (r.full_name ? r.full_name.split('/')[0] : null),
  isOwner,
  isFork: Boolean(r.is_fork),
  description: r.description,
  primaryLanguage: r.primary_language,
  htmlUrl: r.html_url,
  lastAnalyzedAt: r.last_analyzed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * GET /api/github/repos
 * Retrieves synchronized GitHub repositories belonging to the currently authenticated user.
 * Supports optional query param `?type=owned` (default), `?type=collaborations`, or `?type=all`.
 * The default view and main count strictly include repositories owned by the connected user.
 */
export const getRepos = async (req, res) => {
  try {
    const userId = req.user.id;
    const requestedType = (req.query.type || 'owned').toLowerCase();

    const [rows] = await pool.query(
      `SELECT id, user_id, github_repo_id, repo_name, full_name, owner_login, description, primary_language, html_url, is_fork, last_analyzed_at, created_at, updated_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    const userGithub = (req.user.githubUsername || '').trim().toLowerCase();
    const owned = [];
    const collaborations = [];

    for (const r of rows) {
      const owner = (r.owner_login || (r.full_name ? r.full_name.split('/')[0] : '')).toLowerCase();
      // An owned repository has an owner matching the verified linked GitHub username.
      // If user has not linked GitHub or in anonymous test context, treat as owner unless owner differs from known profile.
      const isOwner = userGithub ? owner === userGithub : true;
      if (isOwner) {
        owned.push(formatRepoResponse(r, true));
      } else {
        collaborations.push(formatRepoResponse(r, false));
      }
    }

    let mainList;
    if (requestedType === 'collaborations') {
      mainList = collaborations;
    } else if (requestedType === 'all') {
      mainList = [...owned, ...collaborations];
    } else {
      mainList = owned;
    }

    return res.status(200).json({
      success: true,
      data: {
        repositories: mainList,
        collaborations,
        owned,
        all: [...owned, ...collaborations],
        count: mainList.length,
        ownedCount: owned.length,
        collaborationCount: collaborations.length,
        totalCount: rows.length,
        verifiedUsername: req.user.githubUsername || null,
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
 * Enforces ownership: only repositories for the verified linked account (and legitimate
 * collaborations when OAuth token is available) are persisted. Prunes stale or unowned
 * repositories retained from previous test syncs.
 *
 * Body: { githubUsername: string }
 */
export const syncRepos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { githubUsername } = req.body || {};

    // 1. Verify that user has a verified linked GitHub account
    const [userRows] = await pool.query(
      'SELECT id, github_id, github_username, github_access_token FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const dbUser = userRows[0];

    // Reject unlinked users from synchronizing repositories
    if (!dbUser.github_id || !dbUser.github_username) {
      return res.status(403).json({
        success: false,
        code: 'GITHUB_NOT_LINKED',
        message: 'No linked GitHub account found. Please link your GitHub account before synchronizing repositories.',
      });
    }

    const verifiedUsername = dbUser.github_username;

    // 2. Validate client-supplied username and enforce ownership
    if (!githubUsername || typeof githubUsername !== 'string' || !githubUsername.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A GitHub username is required to synchronize repositories.',
      });
    }

    const trimmedInput = githubUsername.trim();

    const githubUsernameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
    if (!githubUsernameRegex.test(trimmedInput)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GitHub username format. Usernames can only contain alphanumeric characters and single hyphens, and cannot begin or end with a hyphen.',
      });
    }

    // Enforce ownership: reject arbitrary username that does not match verified linked account
    if (trimmedInput.toLowerCase() !== verifiedUsername.toLowerCase()) {
      return res.status(403).json({
        success: false,
        code: 'GITHUB_OWNERSHIP_MISMATCH',
        message: `Forbidden. You can only synchronize repositories for your verified linked GitHub account (@${verifiedUsername}).`,
      });
    }

    // Strictly synchronize the verified linked account
    const trimmedUsername = verifiedUsername;

    // 3. Decrypt the stored OAuth access token so the GitHub API call is authenticated.
    let accessToken = null;
    if (dbUser.github_access_token) {
      try {
        accessToken = decryptToken(dbUser.github_access_token);
      } catch (decryptErr) {
        console.warn('[syncRepos] Failed to decrypt stored GitHub token; falling back to anonymous:', decryptErr.message);
      }
    }

    // 4. Fetch public repositories from GitHub for verified user
    let fetchedRepos;
    try {
      fetchedRepos = await fetchUserRepos(trimmedUsername, accessToken ? { accessToken } : null);
    } catch (err) {
      if (err.status === 404) {
        return res.status(404).json({
          success: false,
          message: `GitHub user '${trimmedUsername}' was not found.`,
        });
      }
      if (err.status === 429 || err.code === 'GITHUB_RATE_LIMITED' || err.code === 'GITHUB_SECONDARY_RATE_LIMITED') {
        const responseBody = {
          success: false,
          code: err.code || 'GITHUB_RATE_LIMITED',
          message: err.message || 'GitHub API rate limit exceeded. Please try again later.',
        };
        if (typeof err.retryAfter === 'number') {
          responseBody.retryAfter = err.retryAfter;
          const minutes = Math.ceil(err.retryAfter / 60);
          responseBody.retryGuidance = err.retryAfter > 0
            ? `Rate limit resets in approximately ${minutes} minute${minutes !== 1 ? 's' : ''}. Please wait before retrying.`
            : 'Rate limit should reset shortly. Please try again in a moment.';
        }
        return res.status(429).json(responseBody);
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

    // Also fetch collaboration repositories when OAuth access token is available
    let collaborationRepos = [];
    if (accessToken) {
      try {
        collaborationRepos = await fetchUserCollaborations(accessToken);
      } catch (collabErr) {
        console.warn('[syncRepos] fetchUserCollaborations error:', collabErr.message);
      }
    }

    const allToSync = [...(fetchedRepos || []), ...collaborationRepos];

    // Handle empty repositories list
    if (allToSync.length === 0) {
      // Clean up any existing repositories in DB for this user
      await pool.query('DELETE FROM repositories WHERE user_id = ?', [userId]);

      return res.status(200).json({
        success: true,
        message: `GitHub user '${trimmedUsername}' has no public repositories.`,
        data: {
          repositories: [],
          collaborations: [],
          owned: [],
          all: [],
          count: 0,
          ownedCount: 0,
          collaborationCount: 0,
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
          owner_login,
          description,
          primary_language,
          html_url,
          is_fork,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          repo_name = VALUES(repo_name),
          full_name = VALUES(full_name),
          owner_login = VALUES(owner_login),
          description = VALUES(description),
          primary_language = VALUES(primary_language),
          html_url = VALUES(html_url),
          is_fork = VALUES(is_fork),
          updated_at = NOW()
      `;

      for (const repo of allToSync) {
        const ownerLogin = repo.ownerLogin || (repo.fullName ? repo.fullName.split('/')[0] : trimmedUsername);
        await connection.query(upsertSql, [
          userId,
          repo.githubRepoId,
          repo.name ? repo.name.slice(0, 191) : 'unnamed-repo',
          repo.fullName ? repo.fullName.slice(0, 191) : 'unknown/repo',
          ownerLogin ? ownerLogin.slice(0, 100) : trimmedUsername,
          repo.description || null,
          repo.primaryLanguage ? repo.primaryLanguage.slice(0, 60) : null,
          repo.htmlUrl ? repo.htmlUrl.slice(0, 255) : '',
          Boolean(repo.isFork),
        ]);
      }

      // 5b. Prune stale repositories: Remove any repository for this user that is NOT
      // part of the verified sync payload (e.g. friend's repositories tested previously)
      const validRepoIds = allToSync.map((r) => r.githubRepoId);
      if (validRepoIds.length > 0) {
        await connection.query(
          'DELETE FROM repositories WHERE user_id = ? AND github_repo_id NOT IN (?)',
          [userId, validRepoIds]
        );
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
      `SELECT id, user_id, github_repo_id, repo_name, full_name, owner_login, description, primary_language, html_url, is_fork, last_analyzed_at, created_at, updated_at
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );

    const owned = [];
    const collaborations = [];

    for (const r of userRepos) {
      const owner = (r.owner_login || (r.full_name ? r.full_name.split('/')[0] : '')).toLowerCase();
      const isOwner = owner === trimmedUsername.toLowerCase();
      if (isOwner) {
        owned.push(formatRepoResponse(r, true));
      } else {
        collaborations.push(formatRepoResponse(r, false));
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${owned.length} public ${owned.length === 1 ? 'repository' : 'repositories'} from @${trimmedUsername}${collaborations.length > 0 ? ` and ${collaborations.length} collaboration ${collaborations.length === 1 ? 'repository' : 'repositories'}` : ''}.`,
      data: {
        repositories: owned,
        collaborations,
        owned,
        all: [...owned, ...collaborations],
        count: owned.length,
        ownedCount: owned.length,
        collaborationCount: collaborations.length,
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
