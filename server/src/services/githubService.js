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
      if (remaining === '0' || response.status === 429) {
        const err = new Error('GitHub API rate limit exceeded. Please try again later.');
        err.status = 429;
        err.code = 'GITHUB_RATE_LIMITED';
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

// Fetch programming language breakdown for a specific repo (for future analysis steps)
export const fetchRepoLanguages = async (fullRepoName, accessToken = null) => {
  // TODO: GET https://api.github.com/repos/{owner}/{repo}/languages
  throw new Error('fetchRepoLanguages - Not yet implemented');
};

// Fetch a specific file's content from a repo (for future analysis steps)
export const fetchFileContent = async (fullRepoName, filePath, accessToken = null) => {
  // TODO: GET https://api.github.com/repos/{owner}/{repo}/contents/{path}
  throw new Error('fetchFileContent - Not yet implemented');
};
