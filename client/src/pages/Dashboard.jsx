import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import SkillCard from '../components/SkillCard';
import RepositoryCard from '../components/RepositoryCard';
import { useAuth } from '../context/AuthContext';
import { githubAPI, authAPI, skillsAPI, analysisAPI } from '../services/api';

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

/** Format ISO date string into a short human-readable date. */
const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
};

/** Maps confidence score to evidence-strength label + colours. */
const getConfidenceRating = (score) => {
  const n = Number(score) || 0;
  if (n >= 75) return { label: 'Strong Evidence', badgeClass: 'badge--green', barColor: 'var(--color-success)' };
  if (n >= 45) return { label: 'Moderate Evidence', badgeClass: 'badge--blue', barColor: 'var(--color-accent)' };
  return { label: 'Initial Signal', badgeClass: 'badge--amber', barColor: 'var(--color-warning)' };
};

/* ─── Stat Card Sub-component ─────────────────────────────────────────────── */
const StatCard = ({ label, value, meta, loading = false }) => (
  <div className="stat-card">
    <p className="stat-card__label">{label}</p>
    {loading ? (
      <div
        style={{
          height: '32px',
          width: '60%',
          backgroundColor: 'var(--color-surface-2)',
          borderRadius: '4px',
          margin: '4px 0',
        }}
      />
    ) : (
      <p className="stat-card__value">{value}</p>
    )}
    <p className="stat-card__meta">{meta}</p>
  </div>
);

/* ─── Alert Sub-component ─────────────────────────────────────────────────── */
const AlertBanner = ({ type = 'info', message, linkTo, linkLabel, onDismiss }) => {
  const colors = {
    success: { border: 'var(--color-success)', bg: 'rgba(46,160,67,0.1)', badge: 'badge--green', icon: '✓', label: 'Success' },
    warning: { border: 'var(--color-warning)', bg: 'rgba(210,153,34,0.1)', badge: 'badge--amber', icon: '⚠', label: 'Warning' },
    error: { border: 'var(--color-danger, #f85149)', bg: 'rgba(218,54,51,0.1)', badge: 'badge--red', icon: '✕', label: 'Error' },
    info: { border: 'var(--color-accent)', bg: 'rgba(88,166,255,0.08)', badge: 'badge--blue', icon: 'ℹ', label: 'Info' },
  };
  const c = colors[type] || colors.info;
  return (
    <div
      className="card mb-6"
      style={{
        borderColor: c.border,
        backgroundColor: c.bg,
        padding: 'var(--space-3) var(--space-4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
      }}
    >
      <div className="flex items-center gap-2">
        <span className={`badge ${c.badge}`} style={{ textTransform: 'uppercase' }}>
          {c.label}
        </span>
        <span style={{ fontSize: 'var(--text-sm)' }}>
          {message}
          {linkTo && linkLabel && (
            <Link to={linkTo} style={{ marginLeft: 'var(--space-2)', color: 'var(--color-link)', fontWeight: 'var(--fw-semibold)' }}>
              {linkLabel} →
            </Link>
          )}
        </span>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="btn btn--secondary btn--sm" style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}>
          Dismiss
        </button>
      )}
    </div>
  );
};

/* ─── Dashboard Page ──────────────────────────────────────────────────────── */
const Dashboard = () => {
  const { user } = useAuth();

  // ── Repository state ────────────────────────────────────────────────────
  const [repositories, setRepositories] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState(null);

  // ── Skills state ────────────────────────────────────────────────────────
  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState(null);

  // ── Sync action state ───────────────────────────────────────────────────
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [syncAlert, setSyncAlert] = useState(null); // { type, message, linkTo, linkLabel }

  // ── Analysis action state ────────────────────────────────────────────────
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisAlert, setAnalysisAlert] = useState(null); // { type, message, linkTo, linkLabel }

  // ── 1. Fetch repositories ────────────────────────────────────────────────
  const fetchRepositories = useCallback(async () => {
    setReposLoading(true);
    setReposError(null);
    try {
      const response = await githubAPI.getRepos();
      if (response?.success && Array.isArray(response?.data?.repositories)) {
        setRepositories(response.data.repositories);
      } else {
        setReposError(response?.message || 'Failed to load repositories.');
      }
    } catch (err) {
      console.error('[Dashboard fetchRepositories error]:', err);
      setReposError(err.message || 'Unable to connect to the server.');
    } finally {
      setReposLoading(false);
    }
  }, []);

  // ── 2. Fetch skills from GET /api/skills ─────────────────────────────────
  const fetchSkills = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    try {
      const response = await skillsAPI.getUserSkills();
      // API may return data as array, data.skills array, or skills array
      const rawList = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.skills)
        ? response.data.skills
        : Array.isArray(response?.skills)
        ? response.skills
        : [];
      setSkills(rawList);

      // Determine most recent analysis time from any repository's lastDetectedAt
      if (rawList.length > 0) {
        const dates = rawList
          .map((s) => s.lastDetectedAt)
          .filter(Boolean)
          .map((d) => new Date(d).getTime())
          .filter((t) => !isNaN(t));
        if (dates.length > 0) {
          setLastAnalyzedAt(new Date(Math.max(...dates)).toISOString());
        }
      }
    } catch (err) {
      console.error('[Dashboard fetchSkills error]:', err);
      setSkillsError(err.message || 'Unable to load skill data.');
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
    fetchSkills();
  }, [fetchRepositories, fetchSkills]);

  // ── 3. Handle GitHub OAuth account linking ───────────────────────────────
  const handleLinkGitHub = async () => {
    setIsLinking(true);
    setSyncAlert(null);
    try {
      const res = await authAPI.getGitHubAuthUrl();
      if (res?.success && res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        setSyncAlert({ type: 'error', message: res?.message || 'Unable to generate GitHub authorization URL.' });
        setIsLinking(false);
      }
    } catch (err) {
      setSyncAlert({ type: 'error', message: err.message || 'Failed to connect to GitHub OAuth service.' });
      setIsLinking(false);
    }
  };

  // ── 4. Handle repository sync ────────────────────────────────────────────
  const handleSync = async () => {
    if (isSyncing) return;
    if (!user?.githubUsername) {
      setSyncAlert({ type: 'error', message: 'Please connect your GitHub account before synchronizing repositories.' });
      return;
    }

    setIsSyncing(true);
    setSyncAlert(null);

    try {
      const response = await githubAPI.syncRepos({ githubUsername: user.githubUsername });
      if (response?.success) {
        const syncedCount = response.data?.syncedCount ?? 0;
        setSyncAlert({
          type: 'success',
          message: response.message || `Synchronized ${syncedCount} public repositories from @${user.githubUsername}.`,
        });
        if (Array.isArray(response.data?.repositories)) {
          setRepositories(response.data.repositories);
        } else {
          await fetchRepositories();
        }
      } else {
        setSyncAlert({ type: 'error', message: response?.message || 'Failed to synchronize repositories.' });
      }
    } catch (err) {
      console.error('[Dashboard sync error]:', err);
      let msg = err.message || 'Synchronization failed. Please check your network and try again.';
      if (err.retryGuidance) msg = `${msg} ${err.retryGuidance}`;
      setSyncAlert({ type: 'error', message: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  // ── 5. Run skill analysis via POST /api/analysis/run ────────────────────
  const handleRunAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisAlert(null);

    try {
      const response = await analysisAPI.runAnalysis();
      const resultData = response?.data;

      if (response?.success) {
        const repoCount = resultData?.analyzedCount ?? 0;
        const evidenceCount = resultData?.evidenceCount ?? 0;
        const distinctCount = resultData?.distinctSkills?.length ?? 0;

        if (resultData?.totalRepositories === 0) {
          setAnalysisAlert({
            type: 'warning',
            message: 'No synchronized repositories found. Sync your repositories first.',
            linkTo: '/repositories',
            linkLabel: 'Manage Repositories',
          });
        } else {
          setAnalysisAlert({
            type: 'success',
            message: `Analysis complete: ${repoCount} ${repoCount === 1 ? 'repository' : 'repositories'} analyzed, ${distinctCount} distinct skills detected (${evidenceCount} evidence records).`,
          });
          // Refresh skills to show updated results
          await fetchSkills();
        }
      } else {
        setAnalysisAlert({ type: 'error', message: response?.message || 'Skill analysis failed.' });
      }
    } catch (err) {
      console.error('[Dashboard runAnalysis error]:', err);
      let msg = err.message || 'Failed to run skill analysis.';
      if (err.retryGuidance) msg = `${msg} ${err.retryGuidance}`;
      setAnalysisAlert({ type: 'error', message: msg });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── 6. Derived data ──────────────────────────────────────────────────────

  /** Top 6 skills by confidence score, for the dashboard preview grid. */
  const topSkills = useMemo(
    () => [...skills].sort((a, b) => (b.confidenceScore || 0) - (a.confidenceScore || 0)).slice(0, 6),
    [skills]
  );

  /** Unique skill categories detected. */
  const categoryCount = useMemo(() => new Set(skills.map((s) => s.category).filter(Boolean)).size, [skills]);

  /** Summary stat cards — all values derived from real API responses. */
  const statCards = useMemo(
    () => [
      {
        id: 'repos',
        label: 'Repositories Synced',
        value: reposLoading ? '–' : String(repositories.length),
        meta:
          repositories.length === 0
            ? user?.githubUsername
              ? 'Ready to synchronize'
              : 'Connect GitHub to import'
            : `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} imported`,
        loading: reposLoading,
      },
      {
        id: 'skills',
        label: 'Skills Detected',
        value: skillsLoading ? '–' : String(skills.length),
        meta:
          skills.length === 0
            ? 'Run analysis to detect skills'
            : `Across ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`,
        loading: skillsLoading,
      },
      {
        id: 'analyzed',
        label: 'Repositories Analyzed',
        value: skillsLoading
          ? '–'
          : skills.length > 0
          ? String(new Set(skills.flatMap((s) => s.contributingRepositories || [])).size || repositories.length)
          : '0',
        meta: skills.length === 0 ? 'No analysis run yet' : 'Used to generate evidence',
        loading: skillsLoading,
      },
      {
        id: 'lastRun',
        label: 'Last Analysis',
        value: skillsLoading ? '–' : lastAnalyzedAt ? formatDate(lastAnalyzedAt) ?? 'Recent' : 'Never',
        meta: lastAnalyzedAt ? 'Click Run Analysis to refresh' : 'No analysis data yet',
        loading: skillsLoading,
      },
    ],
    [repositories, skills, categoryCount, lastAnalyzedAt, reposLoading, skillsLoading, user?.githubUsername]
  );

  return (
    <AppLayout>
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-header__title">Dashboard</h1>
        <p className="page-header__subtitle">
          An overview of your synchronized repositories, detected technical skill evidence, and analysis results.
        </p>
      </div>

      {/* ── Sync Alerts ────────────────────────────────────────────────── */}
      {syncAlert && (
        <AlertBanner
          type={syncAlert.type}
          message={syncAlert.message}
          linkTo={syncAlert.linkTo}
          linkLabel={syncAlert.linkLabel}
          onDismiss={() => setSyncAlert(null)}
        />
      )}

      {/* ── Analysis Alerts ─────────────────────────────────────────────── */}
      {analysisAlert && (
        <AlertBanner
          type={analysisAlert.type}
          message={analysisAlert.message}
          linkTo={analysisAlert.linkTo}
          linkLabel={analysisAlert.linkLabel}
          onDismiss={() => setAnalysisAlert(null)}
        />
      )}

      {/* ── GitHub Connection + Action Banner ──────────────────────────── */}
      <div
        className="card flex items-center justify-between mb-6"
        style={{
          gap: 'var(--space-5)',
          padding: 'var(--space-6) var(--space-8)',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '4px solid var(--color-accent)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <div className="flex items-center gap-3" style={{ marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)' }}>
              {user?.githubUsername
                ? `GitHub: Connected as @${user.githubUsername}`
                : 'GitHub Account: Not Connected'}
            </span>
            {user?.githubUsername ? (
              <span className="badge badge--green">{repositories.length > 0 ? 'Synchronized' : 'Connected'}</span>
            ) : (
              <span className="badge badge--neutral">Not Linked</span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            {user?.githubUsername
              ? `Public repositories are verified and linked to @${user.githubUsername}. Sync anytime to refresh, then run skill analysis.`
              : 'Connect your GitHub account to import repositories and analyze technical skills.'}
          </p>
        </div>

        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          {user?.githubUsername ? (
            <>
              <button
                type="button"
                id="btn-run-analysis"
                className="btn btn--primary"
                onClick={handleRunAnalysis}
                disabled={isAnalyzing || isSyncing}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isAnalyzing ? 'Analyzing...' : 'Run Skill Analysis'}
              </button>
              <button
                type="button"
                id="btn-sync-github"
                className="btn btn--secondary"
                onClick={handleSync}
                disabled={isSyncing || isAnalyzing}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isSyncing ? 'Syncing...' : 'Sync Repositories'}
              </button>
              <Link to="/repositories" className="btn btn--secondary btn--sm" style={{ whiteSpace: 'nowrap' }}>
                Manage
              </Link>
            </>
          ) : (
            <button
              type="button"
              id="btn-link-github"
              className="btn btn--primary"
              onClick={handleLinkGitHub}
              disabled={isLinking}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isLinking ? 'Redirecting to GitHub...' : 'Connect GitHub Account'}
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Stat Cards (real data only) ────────────────────────── */}
      <div className="grid-4 mb-6">
        {statCards.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      {/* ── Skill Evidence Preview ──────────────────────────────────────── */}
      <section aria-labelledby="skills-overview" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="skills-overview" className="section-heading" style={{ marginBottom: '2px' }}>
              Detected Skill Evidence
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Evidence strength based on code volume, dependencies, and project manifests detected in
              your repositories.{' '}
              <span style={{ fontStyle: 'italic', opacity: 0.75 }}>
                These are evidence signals — not developer proficiency ratings.
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/skills" className="btn btn--secondary btn--sm">
              Full Analysis →
            </Link>
          </div>
        </div>

        {skillsLoading ? (
          /* Loading skeleton */
          <div className="grid-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skill-card" style={{ opacity: 0.5 }}>
                <div style={{ height: '18px', width: '55%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '10px' }} />
                <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px' }} />
                <div style={{ height: '13px', width: '35%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
              </div>
            ))}
          </div>
        ) : skillsError ? (
          <div className="card p-4" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-danger, #f85149)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
              {skillsError}
            </p>
            <button type="button" onClick={fetchSkills} className="btn btn--secondary btn--sm">
              Retry
            </button>
          </div>
        ) : topSkills.length === 0 ? (
          /* Empty state — guide user through the correct steps */
          <div className="card empty-state" style={{ padding: 'var(--space-8) var(--space-6)' }}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4, marginBottom: 'var(--space-3)' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M11 8v6" />
              <path d="M8 11h6" />
            </svg>
            <p className="empty-state__title">No Skill Evidence Detected Yet</p>
            <p className="empty-state__desc" style={{ maxWidth: '420px' }}>
              {!user?.githubUsername
                ? 'Connect your GitHub account, sync repositories, then click Run Skill Analysis to populate your skill profile.'
                : repositories.length === 0
                ? 'Sync your GitHub repositories first, then click Run Skill Analysis.'
                : 'Click Run Skill Analysis to scan your repositories and populate your skill profile.'}
            </p>
            <div className="flex items-center gap-3 mt-4" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              {!user?.githubUsername ? (
                <button
                  type="button"
                  onClick={handleLinkGitHub}
                  disabled={isLinking}
                  className="btn btn--primary btn--sm"
                >
                  {isLinking ? 'Redirecting...' : 'Connect GitHub'}
                </button>
              ) : (
                <button
                  type="button"
                  id="btn-run-analysis-empty"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="btn btn--primary btn--sm"
                >
                  {isAnalyzing ? 'Analyzing...' : 'Run Skill Analysis'}
                </button>
              )}
              <Link to="/skills" className="btn btn--secondary btn--sm">
                View Skill Analysis Page
              </Link>
            </div>
          </div>
        ) : (
          /* Top skills grid (up to 6) */
          <>
            <div className="grid-3">
              {topSkills.map((skill) => (
                <SkillCard
                  key={skill.skillName}
                  skillName={skill.skillName}
                  confidenceScore={skill.confidenceScore}
                  category={skill.category}
                  repositoryCount={skill.repositoryCount || (skill.contributingRepositories || []).length || 1}
                />
              ))}
            </div>
            {skills.length > 6 && (
              <p
                style={{
                  marginTop: 'var(--space-4)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'right',
                }}
              >
                Showing top 6 of {skills.length} detected skills.{' '}
                <Link to="/skills" style={{ color: 'var(--color-link)' }}>
                  View all →
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      {/* ── Recent Repositories + Analysis Action Panel ─────────────────── */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Recent Repositories */}
        <section aria-labelledby="recent-repos-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-repos-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Recent Repositories
            </h2>
            <Link to="/repositories" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              View all ({repositories.length})
            </Link>
          </div>

          {reposLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2].map((n) => (
                <div key={n} className="card" style={{ opacity: 0.6, minHeight: '130px' }}>
                  <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '10px' }} />
                  <div style={{ height: '14px', width: '75%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ height: '12px', width: '30%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          ) : reposError ? (
            <div className="card p-4" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-danger, #f85149)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                {reposError}
              </p>
              <button type="button" onClick={fetchRepositories} className="btn btn--secondary btn--sm">
                Retry
              </button>
            </div>
          ) : !user?.githubUsername ? (
            <div className="card empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <p className="empty-state__title" style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>No GitHub Account Connected</p>
              <p className="empty-state__desc" style={{ fontSize: 'var(--text-sm)', maxWidth: '360px', marginBottom: 'var(--space-4)' }}>
                Connect your GitHub account to import and analyze your public repositories.
              </p>
              <button type="button" onClick={handleLinkGitHub} disabled={isLinking} className="btn btn--primary btn--sm">
                {isLinking ? 'Redirecting...' : 'Connect GitHub Account'}
              </button>
            </div>
          ) : repositories.length === 0 ? (
            <div className="card empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" /><path d="M6 10h10" />
              </svg>
              <p className="empty-state__title" style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>No Repositories Synchronized</p>
              <p className="empty-state__desc" style={{ fontSize: 'var(--text-sm)', maxWidth: '360px', marginBottom: 'var(--space-4)' }}>
                Import repositories from @{user.githubUsername} to populate your portfolio.
              </p>
              <button type="button" onClick={handleSync} disabled={isSyncing} className="btn btn--primary btn--sm">
                {isSyncing ? 'Syncing...' : 'Sync Repositories Now'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {repositories.slice(0, 3).map((repo) => (
                <RepositoryCard
                  key={repo.id || repo.repoName}
                  name={repo.repoName}
                  description={repo.description || 'No description provided.'}
                  language={repo.primaryLanguage || 'Unspecified'}
                  visibility="Public"
                  stars={0}
                  forks={0}
                  updatedAt={formatDate(repo.updatedAt) ?? '—'}
                  ownerLogin={repo.ownerLogin}
                  isOwner={repo.isOwner}
                  isFork={repo.isFork}
                  onViewDetails={repo.htmlUrl ? () => window.open(repo.htmlUrl, '_blank') : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {/* Analysis Action Panel */}
        <section aria-labelledby="analysis-panel-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="analysis-panel-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Skill Analysis
            </h2>
            <Link to="/skills" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              Full report →
            </Link>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Evidence transparency note */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderLeft: '3px solid var(--color-accent)',
                backgroundColor: 'var(--color-surface-2)',
                borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
              }}
            >
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                About Evidence Confidence Scores
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                Scores reflect observable code artifacts in your GitHub repositories: language bytes,
                dependency manifests, and tool configs. They indicate{' '}
                <strong>signal strength</strong> — not a subjective proficiency assessment.
              </p>
            </div>

            {/* Summary metrics — all real */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              {[
                {
                  label: 'Skills Detected',
                  value: skillsLoading ? '–' : String(skills.length),
                  note: skillsLoading ? '' : `${categoryCount} categories`,
                },
                {
                  label: 'Last Analysis',
                  value: skillsLoading ? '–' : lastAnalyzedAt ? formatDate(lastAnalyzedAt) ?? 'Recent' : 'Never run',
                  note: lastAnalyzedAt ? 'Evidence is current' : 'No analysis yet',
                },
              ].map(({ label, value, note }) => (
                <div
                  key={label}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-surface-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', marginBottom: '4px' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--color-text-primary)', margin: 0 }}>
                    {value}
                  </p>
                  {note && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
                      {note}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Top 3 detected skill names (or placeholder) */}
            {skills.length > 0 && (
              <div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--space-2)' }}>
                  Top Detected Skills
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                  {topSkills.slice(0, 5).map((s) => {
                    const rating = getConfidenceRating(s.confidenceScore);
                    return (
                      <span key={s.skillName} className={`badge ${rating.badgeClass}`} style={{ fontSize: 'var(--text-xs)' }}>
                        {s.skillName} · {Math.round(s.confidenceScore || 0)}%
                      </span>
                    );
                  })}
                  {skills.length > 5 && (
                    <span className="badge badge--neutral" style={{ fontSize: 'var(--text-xs)' }}>
                      +{skills.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Primary CTA */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <button
                type="button"
                id="btn-run-analysis-panel"
                onClick={handleRunAnalysis}
                className="btn btn--primary btn--sm"
                disabled={isAnalyzing || !user?.githubUsername}
                title={!user?.githubUsername ? 'Connect GitHub first' : undefined}
              >
                {isAnalyzing ? 'Analyzing Repositories...' : 'Run Skill Analysis'}
              </button>
              <Link to="/skills" className="btn btn--secondary btn--sm">
                View Full Report
              </Link>
            </div>

            {!user?.githubUsername && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Connect your GitHub account to enable skill analysis.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
