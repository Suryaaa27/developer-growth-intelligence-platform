import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import SkillCard from '../components/SkillCard';
import RepositoryCard from '../components/RepositoryCard';
import { useAuth } from '../context/AuthContext';
import { githubAPI, authAPI } from '../services/api';

/* ── Sample Competency & Recommendation Data (Analysis Engine Placeholder) ── */
const SAMPLE_SKILLS = [
  { skillName: 'Java', level: 85, category: 'Language' },
  { skillName: 'Spring Boot', level: 75, category: 'Framework' },
  { skillName: 'PostgreSQL', level: 70, category: 'Database' },
  { skillName: 'Docker', level: 50, category: 'Tools' },
  { skillName: 'RESTful APIs', level: 90, category: 'Architecture' },
  { skillName: 'JUnit 5', level: 60, category: 'Testing' },
];

const PRIORITY_RECOMMENDATIONS = [
  {
    id: 1,
    title: 'Integrate Docker containerization in backend projects',
    reason: 'Identified as a critical requirement for Java Backend Developer roles.',
    effort: '3-4 hours',
    priority: 'High',
  },
  {
    id: 2,
    title: 'Increase unit test coverage using JUnit 5 & Mockito',
    reason: 'Test evidence detected in only 1 of repositories analyzed.',
    effort: '2-3 hours',
    priority: 'High',
  },
  {
    id: 3,
    title: 'Implement database indexing & query optimization benchmarks',
    reason: 'Enhances database proficiency evidence for enterprise roles.',
    effort: '4-5 hours',
    priority: 'Medium',
  },
];

/**
 * Format timestamp into human-readable date.
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Recently';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
};

const StatCard = ({ label, value, meta }) => (
  <div className="stat-card">
    <p className="stat-card__label">{label}</p>
    <p className="stat-card__value">{value}</p>
    <p className="stat-card__meta">{meta}</p>
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();

  // Repository state
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Sync and Link action states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);

  // Fetch verified repositories from backend
  const fetchRepositories = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await githubAPI.getRepos();
      if (response?.success && Array.isArray(response?.data?.repositories)) {
        setRepositories(response.data.repositories);
      } else {
        setLoadError(response?.message || 'Failed to load repositories.');
      }
    } catch (err) {
      console.error('[Dashboard fetchRepositories error]:', err);
      setLoadError(err.message || 'Unable to connect to server to fetch repositories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Handle GitHub OAuth initiation for unlinked accounts
  const handleLinkGitHub = async () => {
    setIsLinking(true);
    setSyncError(null);
    try {
      const res = await authAPI.getGitHubAuthUrl();
      if (res?.success && res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        setSyncError(res?.message || 'Unable to generate GitHub authorization URL.');
        setIsLinking(false);
      }
    } catch (err) {
      setSyncError(err.message || 'Failed to connect to GitHub OAuth service.');
      setIsLinking(false);
    }
  };

  // Handle repository synchronization in place without redirecting
  const handleSync = async () => {
    if (isSyncing) return;

    if (!user?.githubUsername) {
      setSyncError('Please connect your GitHub account before synchronizing repositories.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const response = await githubAPI.syncRepos({ githubUsername: user.githubUsername });
      if (response?.success) {
        const syncedCount = response.data?.syncedCount ?? 0;
        setSyncSuccess(
          response.message || `Successfully synchronized ${syncedCount} public repositories from @${user.githubUsername}.`
        );
        // Refresh repository records in place
        if (Array.isArray(response.data?.repositories)) {
          setRepositories(response.data.repositories);
        } else {
          await fetchRepositories();
        }
      } else {
        setSyncError(response?.message || 'Failed to synchronize repositories.');
      }
    } catch (err) {
      console.error('[Dashboard sync error]:', err);
      setSyncError(err.message || 'Synchronization request failed. Please check your network and try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Dynamic stat cards based on real repository data
  const statCards = useMemo(
    () => [
      {
        id: 'repos',
        label: 'Repositories Analyzed',
        value: String(repositories.length),
        meta:
          repositories.length === 0
            ? user?.githubUsername
              ? 'Ready to synchronize'
              : 'Connect GitHub to import'
            : `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} synchronized`,
      },
      { id: 'skills', label: 'Skills Detected', value: '14', meta: 'Across 5 categories' },
      { id: 'gaps', label: 'Skills to Improve', value: '4', meta: 'Target: Java Backend' },
      { id: 'readiness', label: 'Role Readiness', value: '68%', meta: 'Benchmark: 80%' },
    ],
    [repositories.length, user?.githubUsername]
  );

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-header__title">Dashboard</h1>
        <p className="page-header__subtitle">
          Welcome back! Here is an overview of your GitHub repository analysis, detected competencies, and growth milestones.
        </p>
      </div>

      {/* GitHub Connection & Synchronization Banner */}
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
                ? `GitHub Account Status: Connected as @${user.githubUsername}`
                : 'GitHub Account Status: Not Connected'}
            </span>
            {user?.githubUsername ? (
              <span className="badge badge--green">
                {repositories.length > 0 ? 'Synchronized' : 'Connected'}
              </span>
            ) : (
              <span className="badge badge--neutral">Not Linked</span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 0 }}>
            {user?.githubUsername
              ? `Public repositories are verified and linked to @${user.githubUsername}. Sync anytime to update your portfolio evidence.`
              : 'Connect your GitHub account using OAuth to import and analyze public repository evidence.'}
          </p>
        </div>

        <div className="flex items-center gap-3" style={{ flexWrap: 'wrap' }}>
          {user?.githubUsername ? (
            <>
              <button
                type="button"
                id="btn-sync-github"
                className="btn btn--primary"
                onClick={handleSync}
                disabled={isSyncing}
                style={{ whiteSpace: 'nowrap' }}
              >
                {isSyncing ? 'Syncing...' : 'Sync Repositories'}
              </button>
              <Link to="/repositories" className="btn btn--secondary btn--sm" style={{ whiteSpace: 'nowrap' }}>
                Manage Repositories
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

      {/* Sync Success Notification */}
      {syncSuccess && (
        <div
          className="card mb-6"
          style={{
            backgroundColor: 'rgba(46, 160, 67, 0.1)',
            borderColor: 'rgba(46, 160, 67, 0.3)',
            color: 'var(--color-text-primary)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="badge badge--green" style={{ textTransform: 'uppercase' }}>Success</span>
            <span style={{ fontSize: 'var(--text-sm)' }}>{syncSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncSuccess(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sync Error Notification */}
      {syncError && (
        <div
          className="card mb-6"
          style={{
            backgroundColor: 'rgba(218, 54, 51, 0.1)',
            borderColor: 'rgba(218, 54, 51, 0.3)',
            color: 'var(--color-text-primary)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="badge badge--red" style={{ textTransform: 'uppercase' }}>Error</span>
            <span style={{ fontSize: 'var(--text-sm)' }}>{syncError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncError(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid-4 mb-6">
        {statCards.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </div>

      {/* Skill Distribution Visualization */}
      <section aria-labelledby="skills-overview" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 id="skills-overview" className="section-heading" style={{ marginBottom: '2px' }}>
              Skill Distribution & Evidence
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Calculated from commit code signatures, dependencies, and project manifests.
            </p>
          </div>
          <Link to="/skills" className="btn btn--secondary btn--sm">
            View Full Analysis &rarr;
          </Link>
        </div>

        <div className="grid-3">
          {SAMPLE_SKILLS.map((skill) => (
            <SkillCard key={skill.skillName} {...skill} />
          ))}
        </div>
      </section>

      {/* Two Column Section: Recent Repositories & Priority Recommendations */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Recent Repositories (Authenticated User's Live Repositories) */}
        <section aria-labelledby="recent-repos-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recent-repos-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Recent Repositories
            </h2>
            <Link to="/repositories" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              View all ({repositories.length})
            </Link>
          </div>

          {loading ? (
            /* Loading State */
            <div className="flex flex-col gap-4">
              {[1, 2].map((n) => (
                <div key={n} className="card" style={{ opacity: 0.6, minHeight: '130px' }}>
                  <div style={{ height: '18px', width: '40%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '10px' }} />
                  <div style={{ height: '14px', width: '75%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ height: '12px', width: '30%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
                </div>
              ))}
            </div>
          ) : loadError ? (
            /* Error State */
            <div className="card p-4" style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--color-danger, #f85149)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                {loadError}
              </p>
              <button type="button" onClick={fetchRepositories} className="btn btn--secondary btn--sm">
                Retry
              </button>
            </div>
          ) : !user?.githubUsername ? (
            /* Disconnected State */
            <div className="card empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <p className="empty-state__title" style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>
                No GitHub Account Connected
              </p>
              <p className="empty-state__desc" style={{ fontSize: 'var(--text-sm)', maxWidth: '360px', marginBottom: 'var(--space-4)' }}>
                Connect your GitHub account to import your repositories and view analyzed technical competencies.
              </p>
              <button
                type="button"
                onClick={handleLinkGitHub}
                disabled={isLinking}
                className="btn btn--primary btn--sm"
              >
                {isLinking ? 'Redirecting...' : 'Connect GitHub Account'}
              </button>
            </div>
          ) : repositories.length === 0 ? (
            /* Empty State: Connected but 0 repositories */
            <div className="card empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: 'var(--space-2)' }}>
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
                <path d="M6 6h10" />
                <path d="M6 10h10" />
              </svg>
              <p className="empty-state__title" style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-1)' }}>
                No Repositories Synchronized Yet
              </p>
              <p className="empty-state__desc" style={{ fontSize: 'var(--text-sm)', maxWidth: '360px', marginBottom: 'var(--space-4)' }}>
                Import public repositories from @{user.githubUsername} to populate your project portfolio and analyze skills.
              </p>
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="btn btn--primary btn--sm"
              >
                {isSyncing ? 'Syncing...' : 'Sync Repositories Now'}
              </button>
            </div>
          ) : (
            /* Real Repositories List (Top 3 Recent) */
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
                  updatedAt={formatDate(repo.updatedAt)}
                  onViewDetails={repo.htmlUrl ? () => window.open(repo.htmlUrl, '_blank') : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {/* Priority Recommendations */}
        <section aria-labelledby="recommendations-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="recommendations-heading" className="section-heading" style={{ marginBottom: 0 }}>
              Priority Learning Recommendations
            </h2>
            <Link to="/roadmap" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
              View roadmap
            </Link>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {PRIORITY_RECOMMENDATIONS.map((rec) => (
              <div
                key={rec.id}
                style={{
                  paddingBottom: 'var(--space-4)',
                  borderBottom: '1px solid var(--color-border-subtle)',
                }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                    {rec.title}
                  </span>
                  <span className={`badge ${rec.priority === 'High' ? 'badge--amber' : 'badge--blue'}`}>
                    {rec.priority}
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)' }}>
                  {rec.reason}
                </p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)' }}>
                    Est. Effort: {rec.effort}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)', fontWeight: 'var(--fw-medium)' }}>
                    Target: Java Backend Developer
                  </span>
                </div>
              </div>
            ))}

            <Link
              to="/roadmap"
              className="btn btn--secondary btn--sm"
              style={{ marginTop: 'var(--space-2)', alignSelf: 'flex-start' }}
            >
              Open Interactive Roadmap
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
