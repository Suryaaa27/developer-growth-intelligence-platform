import { useState, useEffect, useMemo, useCallback } from 'react';
import AppLayout from '../components/AppLayout';
import RepositoryCard from '../components/RepositoryCard';
import { githubAPI } from '../services/api';

/**
 * Format timestamp into human-readable date.
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Not yet';
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

const GitHubRepositories = () => {
  // State for repository data
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // State for synchronization action
  const [githubUsername, setGithubUsername] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncSuccess, setSyncSuccess] = useState(null);

  // State for filtering and details drawer
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedRepo, setSelectedRepo] = useState(null);

  // Fetch repositories from backend
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
      console.error('[GitHubRepositories fetch error]:', err);
      setLoadError(err.message || 'Unable to connect to server to fetch repositories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepositories();
  }, [fetchRepositories]);

  // Handle repository synchronization
  const handleSync = async (e) => {
    e.preventDefault();
    if (isSyncing) return;

    const trimmed = githubUsername.trim();
    if (!trimmed) {
      setSyncError('Please enter a GitHub username to import.');
      setSyncSuccess(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const response = await githubAPI.syncRepos({ githubUsername: trimmed });
      if (response?.success) {
        const syncedCount = response.data?.syncedCount ?? 0;
        setSyncSuccess(
          response.message || `Successfully imported ${syncedCount} public repositories from @${trimmed}.`
        );
        // Refresh local repository list with updated records
        if (Array.isArray(response.data?.repositories)) {
          setRepositories(response.data.repositories);
        } else {
          await fetchRepositories();
        }
        setGithubUsername('');
      } else {
        setSyncError(response?.message || 'Failed to synchronize repositories.');
      }
    } catch (err) {
      console.error('[GitHubRepositories sync error]:', err);
      setSyncError(err.message || 'Synchronization request failed. Please check your network and try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Derive unique languages from loaded repositories
  const availableLanguages = useMemo(() => {
    const langs = new Set();
    repositories.forEach((repo) => {
      if (repo.primaryLanguage) {
        langs.add(repo.primaryLanguage);
      }
    });
    return Array.from(langs).sort();
  }, [repositories]);

  // Filtered repositories based on search and language filter
  const filteredRepos = useMemo(() => {
    return repositories.filter((repo) => {
      const name = (repo.repoName || '').toLowerCase();
      const desc = (repo.description || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = name.includes(term) || desc.includes(term);
      const matchesLanguage =
        selectedLanguage === 'All' || repo.primaryLanguage === selectedLanguage;
      return matchesSearch && matchesLanguage;
    });
  }, [repositories, searchTerm, selectedLanguage]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">GitHub Repositories</h1>
            <p className="page-header__subtitle">
              Inspect synchronized public repositories and code metadata analyzed for technical competency evidence.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge--neutral">
              {repositories.length} {repositories.length === 1 ? 'Repository' : 'Repositories'} Synced
            </span>
            <button
              type="button"
              onClick={fetchRepositories}
              disabled={loading || isSyncing}
              className="btn btn--secondary btn--sm"
              title="Refresh repository list"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Sync Public GitHub Repositories Form Card */}
      <div
        className="card mb-6"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderLeft: '4px solid var(--color-accent)',
        }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', margin: '0 0 var(--space-1) 0', color: 'var(--color-text-primary)' }}>
              Import Public Repositories
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              Enter a public GitHub username to import repositories. Public code metadata is fetched via the GitHub API without requiring account credentials.
            </p>
          </div>

          <form onSubmit={handleSync} className="flex items-center gap-3" style={{ flexWrap: 'wrap', width: '100%', maxWidth: '480px' }}>
            <div className="search-input-wrapper" style={{ flex: '1 1 200px' }}>
              <input
                type="text"
                id="github-username-input"
                className="form-input"
                placeholder="GitHub username (e.g. octocat)"
                value={githubUsername}
                onChange={(e) => {
                  setGithubUsername(e.target.value);
                  if (syncError) setSyncError(null);
                }}
                disabled={isSyncing}
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <button
              type="submit"
              id="btn-sync-github"
              className="btn btn--primary"
              disabled={isSyncing || !githubUsername.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isSyncing ? 'Syncing...' : 'Sync Repositories'}
            </button>
          </form>
        </div>

        {/* Sync Success Notification */}
        {syncSuccess && (
          <div
            className="card mt-4"
            style={{
              marginTop: 'var(--space-4)',
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
            className="card mt-4"
            style={{
              marginTop: 'var(--space-4)',
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
      </div>

      {/* Load Error Banner */}
      {loadError && (
        <div
          className="card mb-6"
          style={{
            backgroundColor: 'rgba(218, 54, 51, 0.1)',
            borderColor: 'rgba(218, 54, 51, 0.3)',
            color: 'var(--color-text-primary)',
            padding: 'var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 'var(--fw-semibold)', color: 'var(--color-danger, #f85149)' }}>
              Failed to load repositories
            </p>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {loadError}
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRepositories}
            className="btn btn--secondary btn--sm"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Filter and Search Bar (Shown when repositories exist) */}
      {repositories.length > 0 && (
        <div className="filter-bar card card--compact mb-6">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="form-input"
              placeholder="Search repositories by name or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="language-filter" className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
              Filter Language:
            </label>
            <select
              id="language-filter"
              className="form-select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="All">All Languages ({repositories.length})</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Repository Detail Modal / Drawer Card */}
      {selectedRepo && (
        <div
          className="card mb-6"
          style={{
            borderLeft: '4px solid var(--color-accent)',
            backgroundColor: 'var(--color-surface-2)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
            <div>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)' }}>
                {selectedRepo.repoName}
              </span>
              <span className="badge badge--blue" style={{ marginLeft: 'var(--space-3)' }}>
                {selectedRepo.primaryLanguage || 'Unspecified'}
              </span>
              <span className="badge badge--neutral" style={{ marginLeft: 'var(--space-2)' }}>
                {selectedRepo.fullName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedRepo.htmlUrl && (
                <a
                  href={selectedRepo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--secondary btn--sm"
                >
                  Open on GitHub ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setSelectedRepo(null)}
                className="btn btn--secondary btn--sm"
              >
                Close Details &times;
              </button>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
            {selectedRepo.description || 'No description provided for this repository.'}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
          >
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '2px' }}>
                GitHub Repository ID
              </p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                {selectedRepo.githubRepoId}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '2px' }}>
                Last Synchronized
              </p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                {formatDate(selectedRepo.updatedAt)}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', textTransform: 'uppercase', marginBottom: '2px' }}>
                Analysis Status
              </p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                {selectedRepo.lastAnalyzedAt ? formatDate(selectedRepo.lastAnalyzedAt) : 'Pending Skill Analysis'}
              </p>
            </div>
          </div>

          <div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
              Detected Technical Skills:
            </p>
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: '6px',
                border: '1px dashed var(--color-border)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {selectedRepo.lastAnalyzedAt ? (
                'Analysis records synchronized.'
              ) : (
                <span>
                  Technical skill analysis has not been executed on this repository yet. Proceed to <strong>Skill Analysis</strong> to inspect dependencies and code evidence.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="card" style={{ opacity: 0.6, minHeight: '180px' }}>
              <div style={{ height: '20px', width: '50%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '12px' }} />
              <div style={{ height: '14px', width: '85%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '14px', width: '60%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Loaded Repositories Content */}
      {!loading && !loadError && (
        <>
          {repositories.length === 0 ? (
            /* Empty State: No Repositories Synchronized Yet */
            <div className="card empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <p className="empty-state__title">No Repositories Synchronized Yet</p>
              <p className="empty-state__desc">
                Enter a public GitHub username in the box above and click <strong>Sync Repositories</strong> to import code metadata for skill analysis.
              </p>
            </div>
          ) : filteredRepos.length > 0 ? (
            /* Repositories Grid */
            <div className="grid-3">
              {filteredRepos.map((repo) => (
                <RepositoryCard
                  key={repo.id}
                  name={repo.repoName}
                  description={repo.description || 'No description provided.'}
                  language={repo.primaryLanguage || 'Unspecified'}
                  visibility="Public"
                  stars={0}
                  forks={0}
                  updatedAt={formatDate(repo.updatedAt)}
                  onViewDetails={() => setSelectedRepo(repo)}
                />
              ))}
            </div>
          ) : (
            /* Filter Match Empty State */
            <div className="card empty-state">
              <p className="empty-state__title">No repositories matched your filters</p>
              <p className="empty-state__desc">
                Try adjusting your search query or selecting &quot;All Languages&quot; from the dropdown.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedLanguage('All');
                }}
                className="btn btn--secondary btn--sm"
              >
                Reset Filters
              </button>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
};

export default GitHubRepositories;
