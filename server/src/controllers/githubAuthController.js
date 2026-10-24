import pool from '../config/db.js';
import { generateOAuthState, validateAndConsumeOAuthState } from '../utils/oauthState.js';

/**
 * Controller: GitHub OAuth Account Linking
 *
 * Implements authenticated initiation and callback handling to securely link
 * a verified GitHub account identity to the currently authenticated DevGrowth user.
 */

/**
 * GET /api/auth/github
 * Initiates the GitHub OAuth linking flow for the currently authenticated user.
 * Protected by authenticate middleware.
 */
export const initiateGitHubOAuth = async (req, res) => {
  try {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    // Validate server environment configuration
    if (!clientId || !clientSecret || !callbackUrl) {
      console.error('[initiateGitHubOAuth Configuration Error]: Missing required GitHub OAuth environment variables.');
      return res.status(500).json({
        success: false,
        message: 'GitHub OAuth is not configured on the server. Please verify environment settings.',
      });
    }

    // req.user is guaranteed by authenticate middleware
    const userId = req.user.id;

    // Generate cryptographically secure, user-bound, short-lived single-use state
    const state = generateOAuthState(userId);

    // Request minimum permissions needed for public-account identification: read:user
    // Explicitly avoids 'repo' or any private repository scopes
    const scope = 'read:user';

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', callbackUrl);
    githubAuthUrl.searchParams.set('scope', scope);
    githubAuthUrl.searchParams.set('state', state);

    // If client explicitly requested JSON (API fetch)
    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return res.status(200).json({
        success: true,
        data: {
          url: githubAuthUrl.toString(),
        },
      });
    }

    // Direct browser redirect
    return res.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('[initiateGitHubOAuth Error]:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate GitHub OAuth account linking.',
    });
  }
};

/**
 * GET /api/auth/github/callback
 * Handles the redirect from GitHub after user authorization.
 * Validates state, exchanges authorization code for an access token,
 * retrieves the verified GitHub identity, and saves it to the user's database record.
 */
export const handleGitHubCallback = async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const targetRedirectBase = `${clientUrl}/repositories`;

  try {
    const { code, state, error: upstreamError } = req.query;

    // 1. Upstream user cancellation or GitHub-reported error
    if (upstreamError) {
      console.warn('[GitHub Callback Upstream Error]:', upstreamError);
      return res.redirect(`${targetRedirectBase}?github_error=access_denied`);
    }

    // 2. Validate presence of code and state
    if (!code || !state) {
      return res.redirect(`${targetRedirectBase}?github_error=missing_code_or_state`);
    }

    // 3. Cryptographic State Validation & Consumption (Replay Prevention)
    // Nonce is bound to user and single-use; immediately deleted upon validation
    const stateResult = validateAndConsumeOAuthState(state);
    if (!stateResult.valid) {
      console.warn('[GitHub Callback State Error]: Invalid or reused state token:', stateResult.reason);
      return res.redirect(`${targetRedirectBase}?github_error=invalid_state`);
    }

    const userId = stateResult.userId;

    // 4. Verify user exists and is active in MySQL
    const [userRows] = await pool.query(
      'SELECT id, is_active FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (!userRows || userRows.length === 0 || !userRows[0].is_active) {
      return res.redirect(`${targetRedirectBase}?github_error=user_inactive_or_not_found`);
    }

    // 5. Exchange authorization code with GitHub for an access token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;

    if (!clientId || !clientSecret) {
      console.error('[GitHub Callback Error]: GitHub OAuth client credentials missing during token exchange.');
      return res.redirect(`${targetRedirectBase}?github_error=server_config_error`);
    }

    let tokenResponse;
    try {
      tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Developer-Growth-Platform',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      });
    } catch (networkErr) {
      console.error('[GitHub Token Exchange Network Error]:', networkErr.message);
      return res.redirect(`${targetRedirectBase}?github_error=network_error`);
    }

    if (!tokenResponse.ok) {
      console.error(`[GitHub Token Exchange HTTP Error]: Status ${tokenResponse.status}`);
      return res.redirect(`${targetRedirectBase}?github_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    if (!tokenData || !tokenData.access_token) {
      console.error('[GitHub Token Exchange Error]: No access_token returned by GitHub.', tokenData?.error || '');
      return res.redirect(`${targetRedirectBase}?github_error=token_exchange_failed`);
    }

    const accessToken = tokenData.access_token;

    // 6. Fetch verified GitHub user profile
    let userResponse;
    try {
      userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Developer-Growth-Platform',
        },
      });
    } catch (fetchErr) {
      console.error('[GitHub /user API Error]:', fetchErr.message);
      return res.redirect(`${targetRedirectBase}?github_error=network_error`);
    }

    if (!userResponse.ok) {
      console.error(`[GitHub /user API HTTP Error]: Status ${userResponse.status}`);
      return res.redirect(`${targetRedirectBase}?github_error=profile_fetch_failed`);
    }

    const githubProfile = await userResponse.json();
    const githubId = githubProfile?.id;
    const githubUsername = githubProfile?.login;

    if (!githubId || !githubUsername) {
      console.error('[GitHub /user API Error]: Missing id or login in GitHub profile response.');
      return res.redirect(`${targetRedirectBase}?github_error=profile_fetch_failed`);
    }

    // 7. Enforce Unique GitHub Identity Constraint (Graceful Conflict Handling)
    // Check if this GitHub ID is already linked to another DevGrowth user account
    const [conflictRows] = await pool.query(
      'SELECT id FROM users WHERE github_id = ? LIMIT 1',
      [githubId]
    );

    if (conflictRows && conflictRows.length > 0) {
      const existingLinkedUserId = conflictRows[0].id;
      if (Number(existingLinkedUserId) !== Number(userId)) {
        // Account is already linked to a different DevGrowth user
        return res.redirect(`${targetRedirectBase}?github_error=account_already_linked`);
      }
    }

    // 8. Save verified github_id and github_username to initiating user record
    await pool.query(
      'UPDATE users SET github_id = ?, github_username = ? WHERE id = ?',
      [githubId, githubUsername, userId]
    );

    // 9. Redirect to frontend with safe success indicator
    return res.redirect(`${targetRedirectBase}?github=linked`);
  } catch (error) {
    console.error('[handleGitHubCallback Error]:', error.message);
    // Never expose stack traces or raw errors in redirection
    return res.redirect(`${targetRedirectBase}?github_error=server_error`);
  }
};
