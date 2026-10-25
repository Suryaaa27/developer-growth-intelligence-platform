/**
 * GitHub Service
 * Responsible for making requests to the GitHub REST API
 * and returning structured repository data.
 */

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PER_PAGE = 100;
const MAX_PAGES_DEFAULT = 10;

/**
 * Helper to execute a fetch request with an AbortSignal timeout and custom fetcher support.
 */
const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, fetcher = globalThis.fetch) => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetcher(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      const timeoutError = new Error('GitHub API request timed out.');
      timeoutError.status = 504;
      timeoutError.code = 'GITHUB_TIMEOUT';
      throw timeoutError;
    }
    const networkError = new Error('Network failure while connecting to GitHub.');
    networkError.status = 502;
    networkError.code = 'GITHUB_NETWORK_ERROR';
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Fetch a list of public repositories for a given GitHub username.
 * Supports pagination, sensible timeouts, and friendly error codes for 404/403/429.
 *
 * @param {string} githubUsername - Public GitHub username
 * @param {string|object} [optionsOrToken=null] - Optional personal access token string or options object
 * @returns {Promise<Array<object>>} Array of normalized repository objects
 */
export const fetchUserRepos = async (githubUsername, optionsOrToken = null) => {
  if (!githubUsername || typeof githubUsername !== 'string' || !githubUsername.trim()) {
    const err = new Error('A valid GitHub username is required.');
    err.status = 400;
    throw err;
  }

  const cleanUsername = githubUsername.trim();

  // Normalize options
  let accessToken = null;
  let customFetcher = globalThis.fetch;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let perPage = DEFAULT_PER_PAGE;
  let maxPages = MAX_PAGES_DEFAULT;

  if (typeof optionsOrToken === 'string') {
    accessToken = optionsOrToken;
  } else if (optionsOrToken && typeof optionsOrToken === 'object') {
    accessToken = optionsOrToken.accessToken || optionsOrToken.token || null;
    if (typeof optionsOrToken.fetcher === 'function') {
      customFetcher = optionsOrToken.fetcher;
    }
    if (typeof optionsOrToken.timeoutMs === 'number') {
      timeoutMs = optionsOrToken.timeoutMs;
    }
    if (typeof optionsOrToken.perPage === 'number') {
      perPage = optionsOrToken.perPage;
    }
    if (typeof optionsOrToken.maxPages === 'number') {
      maxPages = optionsOrToken.maxPages;
    }
  }

  // Use environment token only if configured; otherwise use anonymous public API access
  const token = accessToken || process.env.GITHUB_TOKEN || null;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Developer-Growth-Platform',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const allRepositories = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage && page <= maxPages) {
    const url = `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?per_page=${perPage}&page=${page}&type=public&sort=updated`;

    const response = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs, customFetcher);

    // Handle User Not Found
    if (response.status === 404) {
      const err = new Error(`GitHub user '${cleanUsername}' not found.`);
      err.status = 404;
      err.code = 'GITHUB_USER_NOT_FOUND';
      throw err;
    }

    // Handle Rate Limiting / Forbidden
    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers?.get ? response.headers.get('x-ratelimit-remaining') : null;
      const resetHeader = response.headers?.get ? response.headers.get('x-ratelimit-reset') : null;
      const retryAfterHeader = response.headers?.get ? response.headers.get('retry-after') : null;

      // Compute seconds until rate limit resets (prefer x-ratelimit-reset epoch, then retry-after)
      let retryAfterSeconds = null;
      if (resetHeader) {
        const resetEpoch = parseInt(resetHeader, 10);
        if (!isNaN(resetEpoch)) {
          retryAfterSeconds = Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
        }
      } else if (retryAfterHeader) {
        const parsed = parseInt(retryAfterHeader, 10);
        if (!isNaN(parsed)) retryAfterSeconds = parsed;
      }

      // Primary rate limit (remaining === '0') or explicit 429
      if (remaining === '0' || response.status === 429) {
        const err = new Error('GitHub API rate limit exceeded. Please try again later.');
        err.status = 429;
        err.code = 'GITHUB_RATE_LIMITED';
        if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
        throw err;
      }

      // Secondary rate limit: GitHub returns 403 with a retry-after header
      if (retryAfterHeader) {
        const err = new Error('GitHub API secondary rate limit triggered. Please try again later.');
        err.status = 429;
        err.code = 'GITHUB_SECONDARY_RATE_LIMITED';
        if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
        throw err;
      }

      const err = new Error('GitHub API request was forbidden.');
      err.status = 403;
      err.code = 'GITHUB_FORBIDDEN';
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`GitHub API returned unexpected status ${response.status}.`);
      err.status = response.status >= 500 ? 502 : response.status;
      err.code = 'GITHUB_API_ERROR';
      throw err;
    }

    const pageData = await response.json();
    if (!Array.isArray(pageData)) {
      const err = new Error('Invalid response structure received from GitHub.');
      err.status = 502;
      throw err;
    }

    // Empty list on page
    if (pageData.length === 0) {
      break;
    }

    for (const repo of pageData) {
      allRepositories.push({
        githubRepoId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || null,
        primaryLanguage: repo.language || null,
        htmlUrl: repo.html_url,
        isPrivate: Boolean(repo.private),
        isFork: Boolean(repo.fork),
        stars: Number(repo.stargazers_count ?? 0),
        forks: Number(repo.forks_count ?? 0),
        defaultBranch: repo.default_branch || 'main',
        updatedAt: repo.updated_at,
      });
    }

    // If fewer repositories than perPage, we reached the end of the public list
    if (pageData.length < perPage) {
      hasNextPage = false;
    } else {
      page++;
    }
  }

  return allRepositories;
};

/**
 * Fetch the byte-count language breakdown for a specific repository.
 * Returns an object like { JavaScript: 12345, TypeScript: 6789 }.
 * Returns null (not throws) when the repo has no language stats (empty repo).
 *
 * @param {string} fullRepoName - "owner/repo" format
 * @param {string|null} [accessToken=null] - Optional OAuth/PAT token
 * @param {object} [_options={}] - Internal override hook for tests ({ fetcher, timeoutMs })
 * @returns {Promise<object|null>} Language byte map or null
 */
export const fetchRepoLanguages = async (fullRepoName, accessToken = null, _options = {}) => {
  if (!fullRepoName || typeof fullRepoName !== 'string' || !fullRepoName.includes('/')) {
    const err = new Error('fullRepoName must be in "owner/repo" format.');
    err.status = 400;
    throw err;
  }

  const token = accessToken || process.env.GITHUB_TOKEN || null;
  const customFetcher = _options.fetcher || globalThis.fetch;
  const timeoutMs = _options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Developer-Growth-Platform',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const [owner, repo] = fullRepoName.split('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`;

  const response = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs, customFetcher);

  if (response.status === 404) {
    const err = new Error(`Repository '${fullRepoName}' not found on GitHub.`);
    err.status = 404;
    err.code = 'GITHUB_REPO_NOT_FOUND';
    throw err;
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers?.get ? response.headers.get('x-ratelimit-remaining') : null;
    const resetHeader = response.headers?.get ? response.headers.get('x-ratelimit-reset') : null;
    const retryAfterHeader = response.headers?.get ? response.headers.get('retry-after') : null;

    let retryAfterSeconds = null;
    if (resetHeader) {
      const resetEpoch = parseInt(resetHeader, 10);
      if (!isNaN(resetEpoch)) retryAfterSeconds = Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
    } else if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed)) retryAfterSeconds = parsed;
    }

    if (remaining === '0' || response.status === 429) {
      const err = new Error('GitHub API rate limit exceeded. Please try again later.');
      err.status = 429;
      err.code = 'GITHUB_RATE_LIMITED';
      if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
      throw err;
    }

    if (retryAfterHeader) {
      const err = new Error('GitHub API secondary rate limit triggered. Please try again later.');
      err.status = 429;
      err.code = 'GITHUB_SECONDARY_RATE_LIMITED';
      if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
      throw err;
    }

    const err = new Error('GitHub API request was forbidden.');
    err.status = 403;
    err.code = 'GITHUB_FORBIDDEN';
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`GitHub API returned unexpected status ${response.status} for languages endpoint.`);
    err.status = response.status >= 500 ? 502 : response.status;
    err.code = 'GITHUB_API_ERROR';
    throw err;
  }

  let languageMap;
  try {
    languageMap = await response.json();
  } catch {
    const err = new Error('Invalid JSON response from GitHub languages endpoint.');
    err.status = 502;
    err.code = 'GITHUB_PARSE_ERROR';
    throw err;
  }

  // GitHub returns {} for repos with no detectable language — normalize to null
  if (!languageMap || typeof languageMap !== 'object' || Array.isArray(languageMap)) {
    return null;
  }

  if (Object.keys(languageMap).length === 0) {
    return null;
  }

  return languageMap;
};

/**
 * Fetch a single file's decoded text content from a repository.
 * Uses the GitHub Contents API. Returns null when the path does not exist
 * (404) so callers can gracefully skip missing manifests without crashing.
 *
 * Files > 1 MB are skipped; the GitHub API truncates or rejects them.
 * Content is Base64-decoded safely; binary files that cannot be decoded
 * as UTF-8 are returned as null.
 *
 * @param {string} fullRepoName - "owner/repo" format
 * @param {string} filePath - Path within the repo, e.g. "package.json"
 * @param {string|null} [accessToken=null] - Optional OAuth/PAT token
 * @param {object} [_options={}] - Internal override hook for tests ({ fetcher, timeoutMs })
 * @returns {Promise<string|null>} Decoded file text, or null if absent/binary/oversized
 */
export const fetchFileContent = async (fullRepoName, filePath, accessToken = null, _options = {}) => {
  if (!fullRepoName || typeof fullRepoName !== 'string' || !fullRepoName.includes('/')) {
    const err = new Error('fullRepoName must be in "owner/repo" format.');
    err.status = 400;
    throw err;
  }

  if (!filePath || typeof filePath !== 'string') {
    const err = new Error('filePath must be a non-empty string.');
    err.status = 400;
    throw err;
  }

  const token = accessToken || process.env.GITHUB_TOKEN || null;
  const customFetcher = _options.fetcher || globalThis.fetch;
  const timeoutMs = _options.timeoutMs || DEFAULT_TIMEOUT_MS;

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'Developer-Growth-Platform',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const [owner, repo] = fullRepoName.split('/');
  const safePath = filePath.replace(/^\//u, ''); // strip leading slash
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}`;

  const response = await fetchWithTimeout(url, { method: 'GET', headers }, timeoutMs, customFetcher);

  // 404 = file simply doesn't exist in this repo — not an error for callers
  if (response.status === 404) {
    return null;
  }

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers?.get ? response.headers.get('x-ratelimit-remaining') : null;
    const resetHeader = response.headers?.get ? response.headers.get('x-ratelimit-reset') : null;
    const retryAfterHeader = response.headers?.get ? response.headers.get('retry-after') : null;

    let retryAfterSeconds = null;
    if (resetHeader) {
      const resetEpoch = parseInt(resetHeader, 10);
      if (!isNaN(resetEpoch)) retryAfterSeconds = Math.max(0, resetEpoch - Math.floor(Date.now() / 1000));
    } else if (retryAfterHeader) {
      const parsed = parseInt(retryAfterHeader, 10);
      if (!isNaN(parsed)) retryAfterSeconds = parsed;
    }

    if (remaining === '0' || response.status === 429) {
      const err = new Error('GitHub API rate limit exceeded. Please try again later.');
      err.status = 429;
      err.code = 'GITHUB_RATE_LIMITED';
      if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
      throw err;
    }

    if (retryAfterHeader) {
      const err = new Error('GitHub API secondary rate limit triggered. Please try again later.');
      err.status = 429;
      err.code = 'GITHUB_SECONDARY_RATE_LIMITED';
      if (retryAfterSeconds !== null) err.retryAfter = retryAfterSeconds;
      throw err;
    }

    const err = new Error('GitHub API request was forbidden.');
    err.status = 403;
    err.code = 'GITHUB_FORBIDDEN';
    throw err;
  }

  if (!response.ok) {
    const err = new Error(`GitHub API returned unexpected status ${response.status} for contents endpoint.`);
    err.status = response.status >= 500 ? 502 : response.status;
    err.code = 'GITHUB_API_ERROR';
    throw err;
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    // Unparseable response — treat as absent
    return null;
  }

  // Guard: the API should return an object, not an array (directory listing)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  // Skip files that are too large (GitHub reports size in bytes)
  const MAX_FILE_BYTES = 1_000_000; // 1 MB
  if (typeof payload.size === 'number' && payload.size > MAX_FILE_BYTES) {
    return null;
  }

  if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
    return null;
  }

  // GitHub wraps Base64 lines with newlines — strip before decoding
  const base64Clean = payload.content.replace(/\n/g, '');

  try {
    return Buffer.from(base64Clean, 'base64').toString('utf8');
  } catch {
    // Binary file that can't be decoded as UTF-8 — skip
    return null;
  }
};
