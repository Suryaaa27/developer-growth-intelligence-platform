/**
 * Skill Detection Service
 *
 * Orchestrates the three analyzers (language, dependency, file evidence) to
 * produce a deduplicated list of SkillEvidence-compatible records for a single
 * repository or all of a user's synchronized repositories.
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 * • Evidence, not assertion: every confidenceScore describes the strength of
 *   observable signals, NOT the developer's actual proficiency.
 *
 * • Transparent scoring: when the same skill is detected by multiple analyzers
 *   for the same repository, the scores are combined using a weighted maximum
 *   formula (see combineConfidenceScores below). The formula, its constants,
 *   and the reasoning behind them are documented in-line.
 *
 * • Attribution preserved: every returned record carries the source repository's
 *   fullName and the evidenceType/evidenceDetails from the analyzer that produced
 *   it, so the UI can later explain why a skill was detected.
 *
 * • Fail-safe: errors fetching or analyzing an individual repository are caught
 *   and logged. The rest of the repositories continue to be processed.
 *
 * • No database writes here: this service is pure computation. The controller
 *   layer (Phase 1B) is responsible for persisting results.
 *
 * ─── Scoring rules for cross-analyzer deduplication ──────────────────────────
 *
 * When the same skillName is detected by multiple analyzers within one repo:
 *
 *   combinedScore = min(
 *     MAX_COMBINED,
 *     max(scores) + BONUS_PER_CORROBORATION * (count - 1)
 *   )
 *
 *   MAX_COMBINED         = 92   (never claim "perfect" evidence)
 *   BONUS_PER_CORROBORATION = 5  (each additional independent signal adds 5 pts)
 *
 * Rationale: the highest single-signal score acts as a base; each corroborating
 * signal from a different analyzer raises confidence modestly. The cap prevents
 * over-inflation from many weak signals.
 *
 * ─── Cross-repo aggregation rules ────────────────────────────────────────────
 *
 * When aggregating across multiple repositories (aggregateSkillsForUser):
 *
 *   aggregatedScore = min(
 *     MAX_AGGREGATED,
 *     max(perRepoScores) + CROSS_REPO_BONUS * (repoCount - 1)
 *   )
 *
 *   MAX_AGGREGATED    = 95
 *   CROSS_REPO_BONUS  = 3   (seeing the same skill in N repos adds 3*(N-1) pts)
 *
 * The returned record for each skill lists all contributing repository fullNames.
 */

import { fetchRepoLanguages, fetchFileContent } from './githubService.js';
import { analyzeLanguages } from '../analyzers/languageAnalyzer.js';
import { analyzePackageJson, analyzePomXml } from '../analyzers/dependencyAnalyzer.js';
import { analyzeFileEvidence } from '../analyzers/fileEvidenceAnalyzer.js';
import pool from '../config/db.js';

// ─── Scoring constants ────────────────────────────────────────────────────────

const MAX_COMBINED = 92;
const BONUS_PER_CORROBORATION = 5;
const MAX_AGGREGATED = 95;
const CROSS_REPO_BONUS = 3;

// ─── Manifest paths to probe ──────────────────────────────────────────────────
// These are the ONLY file paths we will fetch from any repository.
// NEVER expand this list to include source files or arbitrary paths.

const MANIFEST_PATHS = [
  'package.json',
  'pom.xml',
];

// Top-level file paths to request from the root contents listing.
// We use the GitHub contents endpoint on the root ("/") which returns
// a directory listing rather than file content.
const ROOT_CONTENTS_PATH = '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Combine multiple confidence scores for the same skill within one repository.
 * See module-level JSDoc for the formula rationale.
 *
 * @param {number[]} scores - Array of individual confidence scores
 * @returns {number} Combined score, capped at MAX_COMBINED
 */
const combineConfidenceScores = (scores) => {
  if (!scores || scores.length === 0) return 0;
  const highest = Math.max(...scores);
  const bonus = BONUS_PER_CORROBORATION * (scores.length - 1);
  return Math.min(MAX_COMBINED, highest + bonus);
};

/**
 * Merge an array of raw evidence records by skillName, combining scores and
 * concatenating evidenceDetails from all sources.
 *
 * @param {Array<object>} records - Raw evidence records from one or more analyzers
 * @returns {Array<object>} Deduplicated, combined evidence records
 */
const mergeEvidenceBySkill = (records) => {
  const map = new Map();

  for (const rec of records) {
    const existing = map.get(rec.skillName);
    if (!existing) {
      map.set(rec.skillName, {
        skillName: rec.skillName,
        category: rec.category,
        confidenceScore: rec.confidenceScore,
        evidenceType: rec.evidenceType,
        evidenceDetails: rec.evidenceDetails,
        _allScores: [rec.confidenceScore],
        _allDetails: [rec.evidenceDetails],
        _allTypes: [rec.evidenceType],
      });
    } else {
      existing._allScores.push(rec.confidenceScore);
      existing._allDetails.push(rec.evidenceDetails);
      existing._allTypes.push(rec.evidenceType);

      // Combine scores
      existing.confidenceScore = combineConfidenceScores(existing._allScores);

      // Prefer the most informative evidenceType label
      const typePriority = ['language_bytes', 'dependency', 'config_file'];
      const bestType = existing._allTypes
        .slice()
        .sort((a, b) => typePriority.indexOf(a) - typePriority.indexOf(b))[0];
      existing.evidenceType = bestType || rec.evidenceType;

      // Concatenate all detail strings for full transparency
      existing.evidenceDetails = existing._allDetails.join(' | ');
    }
  }

  // Strip internal bookkeeping fields
  return Array.from(map.values()).map(({ _allScores, _allDetails, _allTypes, ...clean }) => clean);
};

/**
 * Fetch the root file listing of a repository and return an array of
 * top-level file paths.
 *
 * Uses fetchFileContent with the root path ('') which returns a directory
 * listing (array) from GitHub's Contents API. Returns [] gracefully on error.
 *
 * @param {string} fullRepoName - "owner/repo"
 * @param {Function} fetcher    - Optional fetch override (for tests)
 * @returns {Promise<string[]>}
 */
const fetchRootFilePaths = async (fullRepoName, fetcher, accessToken = null) => {
  try {
    const token = accessToken || process.env.GITHUB_TOKEN || null;
    const [owner, repo] = fullRepoName.split('/');

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Developer-Growth-Platform',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const customFetcher = fetcher || globalThis.fetch;
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;

    const response = await customFetcher(url, { method: 'GET', headers });

    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers?.get ? response.headers.get('x-ratelimit-remaining') : null;
      if (remaining === '0' || response.status === 429) {
        const err = new Error('GitHub API rate limit exceeded.');
        err.status = 429;
        err.code = 'GITHUB_RATE_LIMITED';
        throw err;
      }
    }

    if (!response.ok) return [];

    const data = await response.json().catch(() => []);
    if (!Array.isArray(data)) return [];

    // GitHub returns objects with { name, path, type } — extract path strings only
    return data
      .filter((item) => item && typeof item.path === 'string')
      .map((item) => item.path);
  } catch (err) {
    if (err?.code === 'GITHUB_RATE_LIMITED') throw err;
    return [];
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect skills from a single repository using all three analyzers.
 *
 * Fetches:
 *   1. Language byte map   → languageAnalyzer
 *   2. package.json        → dependencyAnalyzer (if present)
 *   3. pom.xml             → dependencyAnalyzer (if present)
 *   4. Root file listing   → fileEvidenceAnalyzer
 *
 * Only the MANIFEST_PATHS allowlist is fetched for file content.
 *
 * @param {{
 *   id: number,
 *   fullName: string,
 *   primaryLanguage: string|null,
 *   userId: number,
 * }} repository - A repository record from the DB (as returned by githubController)
 *
 * @param {object} [_options={}] - Internal test hook: { fetcher }
 *
 * @returns {Promise<Array<{
 *   skillName: string,
 *   category: string,
 *   confidenceScore: number,
 *   evidenceType: string,
 *   evidenceDetails: string,
 *   repositoryFullName: string,
 *   repositoryId: number,
 * }>>}
 *   Array of skill evidence records with repository attribution.
 *   Returns [] on complete failure (individual analyzer errors are swallowed).
 */
export const detectSkillsFromRepo = async (repository, _options = {}) => {
  if (!repository || typeof repository.fullName !== 'string' || !repository.fullName.includes('/')) {
    return [];
  }

  const { fullName, id: repositoryId } = repository;
  const fetcher = _options.fetcher || null;
  const accessToken = _options.accessToken || null;

  const allRawEvidence = [];

  // ── 1. Language analysis ─────────────────────────────────────────────────
  try {
    const languageMap = await fetchRepoLanguages(fullName, accessToken, fetcher ? { fetcher } : {});
    if (languageMap) {
      const langEvidence = analyzeLanguages(languageMap);
      allRawEvidence.push(...langEvidence);
    }
  } catch (err) {
    if (err?.code === 'GITHUB_RATE_LIMITED' || err?.code === 'GITHUB_REPO_NOT_FOUND') throw err;
    // Transient error: log but continue
    console.warn(`[skillDetectionService] Language fetch failed for ${fullName}: ${err.message}`);
  }

  // ── 2. Dependency manifests ──────────────────────────────────────────────
  for (const manifestPath of MANIFEST_PATHS) {
    try {
      const content = await fetchFileContent(fullName, manifestPath, accessToken, fetcher ? { fetcher } : {});
      if (content !== null) {
        let depEvidence = [];
        if (manifestPath === 'package.json') {
          depEvidence = analyzePackageJson(content);
        } else if (manifestPath === 'pom.xml') {
          depEvidence = analyzePomXml(content);
        }
        allRawEvidence.push(...depEvidence);
      }
    } catch (err) {
      // Rate limit: surface it up
      if (err?.code === 'GITHUB_RATE_LIMITED') throw err;
      console.warn(`[skillDetectionService] Manifest fetch failed for ${fullName}/${manifestPath}: ${err.message}`);
    }
  }

  // ── 3. File evidence (root listing only) ─────────────────────────────────
  try {
    const rootPaths = await fetchRootFilePaths(fullName, fetcher, accessToken);
    if (rootPaths.length > 0) {
      const fileEvidence = analyzeFileEvidence(rootPaths);
      allRawEvidence.push(...fileEvidence);
    }
  } catch (err) {
    if (err?.code === 'GITHUB_RATE_LIMITED') throw err;
    console.warn(`[skillDetectionService] Root listing failed for ${fullName}: ${err.message}`);
  }

  // ── 4. Merge and annotate with repository attribution ────────────────────
  const merged = mergeEvidenceBySkill(allRawEvidence);

  return merged.map((rec) => ({
    ...rec,
    repositoryId: repositoryId ?? null,
    repositoryFullName: fullName,
  }));
};

/**
 * Detect and aggregate skills across ALL synchronized repositories for a user.
 *
 * Loads every repository record for the user from the database, runs
 * detectSkillsFromRepo for each, then aggregates results by skillName across
 * repositories using CROSS_REPO_BONUS scoring.
 *
 * Individual repository failures are recovered from; the function completes
 * with partial results and logs which repos failed.
 *
 * @param {number} userId - Authenticated user's database ID
 *
 * @param {object} [_options={}] - Internal test hook: { fetcher }
 *
 * @returns {Promise<Array<{
 *   skillName: string,
 *   category: string,
 *   confidenceScore: number,
 *   evidenceType: string,
 *   evidenceDetails: string,
 *   repositoryFullNames: string[],
 *   repositoryIds: number[],
 *   repoCount: number,
 * }>>}
 *   Aggregated skill records sorted by confidenceScore descending.
 *   Returns [] when the user has no synchronized repositories.
 */
export const aggregateSkillsForUser = async (userId, _options = {}) => {
  if (!userId || typeof userId !== 'number') {
    return [];
  }

  // Load all repositories for this user from the DB
  let repositories;
  try {
    const [rows] = await pool.query(
      `SELECT id, user_id, full_name, primary_language
       FROM repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    );
    repositories = rows;
  } catch (err) {
    console.error(`[skillDetectionService] DB query failed for userId=${userId}: ${err.message}`);
    return [];
  }

  if (!repositories || repositories.length === 0) {
    return [];
  }

  // Map DB column names to the shape detectSkillsFromRepo expects
  const repoList = repositories.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    primaryLanguage: r.primary_language,
    userId: r.user_id,
  }));

  // Detect skills per repo; recover from individual failures
  const perRepoResults = [];
  for (const repo of repoList) {
    try {
      const skills = await detectSkillsFromRepo(repo, _options);
      perRepoResults.push({ repo, skills });
    } catch (err) {
      if (err.code === 'GITHUB_RATE_LIMITED') {
        // Rate limit affects all repos equally — surface it
        throw err;
      }
      console.warn(
        `[skillDetectionService] Skipping repo ${repo.fullName} due to error: ${err.message}`
      );
    }
  }

  // ── Aggregate across repositories ────────────────────────────────────────
  const aggregationMap = new Map();

  for (const { skills } of perRepoResults) {
    for (const skill of skills) {
      const existing = aggregationMap.get(skill.skillName);

      if (!existing) {
        aggregationMap.set(skill.skillName, {
          skillName: skill.skillName,
          category: skill.category,
          evidenceType: skill.evidenceType,
          evidenceDetails: skill.evidenceDetails,
          repositoryFullNames: skill.repositoryFullName ? [skill.repositoryFullName] : [],
          repositoryIds: skill.repositoryId != null ? [skill.repositoryId] : [],
          _perRepoScores: [skill.confidenceScore],
          confidenceScore: skill.confidenceScore,
        });
      } else {
        // Only add this repo's attribution once per skill
        if (skill.repositoryFullName && !existing.repositoryFullNames.includes(skill.repositoryFullName)) {
          existing.repositoryFullNames.push(skill.repositoryFullName);
          if (skill.repositoryId != null) existing.repositoryIds.push(skill.repositoryId);
        }
        existing._perRepoScores.push(skill.confidenceScore);

        // Aggregate confidence: best score + cross-repo bonus
        const best = Math.max(...existing._perRepoScores);
        const repoCount = existing.repositoryFullNames.length;
        existing.confidenceScore = Math.min(MAX_AGGREGATED, best + CROSS_REPO_BONUS * (repoCount - 1));

        // Append new evidence details
        if (skill.evidenceDetails && !existing.evidenceDetails.includes(skill.evidenceDetails)) {
          existing.evidenceDetails += ` | ${skill.evidenceDetails}`;
        }

        // Use the most "primary" evidenceType (language_bytes > dependency > config_file)
        const typePriority = ['language_bytes', 'dependency', 'config_file'];
        if (typePriority.indexOf(skill.evidenceType) < typePriority.indexOf(existing.evidenceType)) {
          existing.evidenceType = skill.evidenceType;
        }
      }
    }
  }

  // Clean up internal bookkeeping and add repoCount
  const aggregated = Array.from(aggregationMap.values()).map(
    ({ _perRepoScores, ...clean }) => ({
      ...clean,
      repoCount: clean.repositoryFullNames.length,
    })
  );

  // Sort by confidence descending
  aggregated.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return aggregated;
};
