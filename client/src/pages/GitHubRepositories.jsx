import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import RepositoryCard from '../components/RepositoryCard';
import { githubAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

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
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for repository data: separated into owned and collaborations
  const [ownedRepositories, setOwnedRepositories] = useState([]);
  const [collaborations, setCollaborations] = useState([]);
  const [activeTab, setActiveTab] = useState('owned'); // 'owned' | 'collaborations'
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // State for synchronization action
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
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
      if (response?.success && response?.data) {
        const owned = Array.isArray(response.data.repositories) ? response.data.repositories : [];
        const collabs = Array.isArray(response.data.collaborations) ? response.data.collaborations : [];
        setOwnedRepositories(owned);
        setCollaborations(collabs);
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

  // Handle OAuth callback indicators in URL query parameters
  useEffect(() => {
    const linked = searchParams.get('github');
    const error = searchParams.get('github_error');

    if (linked === 'linked') {
      setSyncSuccess('GitHub account linked successfully! Your verified profile is now connected.');
      setSyncError(null);
      if (refreshUser) refreshUser();
      fetchRepositories();
      setSearchParams({}, { replace: true });
    } else if (error) {
      const errorMap = {
        access_denied: 'GitHub authorization was cancelled or access was denied.',
        account_already_linked: 'This GitHub account is already linked to another DevGrowth user.',
        invalid_state: 'Invalid or expired authorization request. Please try linking again.',
        missing_code_or_state: 'Missing authorization code or state from GitHub callback.',
        token_exchange_failed: 'Failed to exchange authorization code with GitHub.',
        profile_fetch_failed: 'Failed to retrieve verified user profile from GitHub.',
        user_inactive_or_not_found: 'Account is inactive or not found.',
        network_error: 'Network failure while connecting to GitHub API.',
        server_config_error: 'GitHub OAuth is not configured properly on the server.',
        server_error: 'An unexpected server error occurred during GitHub linking.',
      };
      setSyncError(errorMap[error] || 'Failed to link GitHub account. Please try again.');
      setSyncSuccess(null);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refreshUser, fetchRepositories]);

  // Handle GitHub OAuth account linking initiation
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

  // Handle repository synchronization using verified linked account
  const handleSync = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSyncing) return;

    if (!user?.githubUsername) {
      setSyncError('Please link your GitHub account before synchronizing repositories.');
      setSyncSuccess(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const response = await githubAPI.syncRepos({ githubUsername: user.githubUsername });
      if (response?.success) {
        const syncedCount = response.data?.syncedCount ?? 0;
        const collabCount = response.data?.collaborationCount ?? 0;
        let msg = response.message || `Successfully imported ${syncedCount} public repositories from @${user.githubUsername}.`;
        if (collabCount > 0) {
          msg += ` (${collabCount} collaboration repositories identified).`;
        }
        setSyncSuccess(msg);

        // Update local state with fresh data
        if (response.data) {
          setOwnedRepositories(Array.isArray(response.data.repositories) ? response.data.repositories : []);
          setCollaborations(Array.isArray(response.data.collaborations) ? response.data.collaborations : []);
        } else {
          await fetchRepositories();
        }
      } else {
        setSyncError(response?.message || 'Failed to synchronize repositories.');
      }
    } catch (err) {
      console.error('[GitHubRepositories sync error]:', err);
      let displayMessage = err.message || 'Synchronization request failed. Please check your network and try again.';
      if (err.retryGuidance) {
        displayMessage = `${displayMessage} ${err.retryGuidance}`;
      }
      setSyncError(displayMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  // Active list based on selected tab
  const activeRepositories = useMemo(() => {
    return activeTab === 'collaborations' ? collaborations : ownedRepositories;
  }, [activeTab, collaborations, ownedRepositories]);

  // Derive unique languages from active list
  const availableLanguages = useMemo(() => {
    const langs = new Set();
    activeRepositories.forEach((repo) => {
      if (repo.primaryLanguage) {
        langs.add(repo.primaryLanguage);
      }
    });
    return Array.from(langs).sort();
  }, [activeRepositories]);

  // Filtered repositories based on search and language filter
  const filteredRepos = useMemo(() => {
    return activeRepositories.filter((repo) => {
      const name = (repo.repoName || '').toLowerCase();
      const desc = (repo.description || '').toLowerCase();
      const owner = (repo.ownerLogin || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = name.includes(term) || desc.includes(term) || owner.includes(term);
      const matchesLanguage =
        selectedLanguage === 'All' || repo.primaryLanguage === selectedLanguage;
      return matchesSearch && matchesLanguage;
    });
  }, [activeRepositories, searchTerm, selectedLanguage]);

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">GitHub Repositories</h1>
            <p className="page-header__subtitle">
              Inspect synchronized repositories and code metadata analyzed for technical competency evidence.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge--green">
              {ownedRepositories.length} {ownedRepositories.length === 1 ? 'Repository' : 'Repositories'} Owned
            </span>
            {collaborations.length > 0 && (
              <span className="badge badge--amber">
                {collaborations.length} {collaborations.length === 1 ? 'Collaboration' : 'Collaborations'}
              </span>
            )}
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
            <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
              <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', margin: 0, color: 'var(--color-text-primary)' }}>
                {user?.githubUsername ? 'Synchronize Verified Repositories' : 'Link Your GitHub Account'}
              </h2>
              {user?.githubUsername && (
                <span className="badge badge--green" style={{ fontSize: 'var(--text-xs)' }}>
                  Connected: @{user.githubUsername}
                </span>
              )}
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
              {user?.githubUsername
                ? `Repositories are synchronized directly for your verified GitHub profile (@${user.githubUsername}). Repositories you own are distinguished from collaborations.`
                : 'Authenticate with GitHub to securely link your developer profile and import verified repositories.'}
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
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleLinkGitHub}
                  disabled={isLinking}
                  title="Link a different GitHub account or refresh authorization"
                >
                  {isLinking ? 'Connecting...' : 'Re-link Account'}
                </button>
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

      {/* View Toggle Tabs: My Repositories vs Collaborations */}
      <div className="flex items-center gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          id="tab-my-repositories"
          onClick={() => {
            setActiveTab('owned');
            setSelectedLanguage('All');
          }}
          className={`btn btn--sm ${activeTab === 'owned' ? 'btn--primary' : 'btn--secondary'}`}
        >
          My Repositories ({ownedRepositories.length})
        </button>
        <button
          type="button"
          id="tab-collaborations"
          onClick={() => {
            setActiveTab('collaborations');
            setSelectedLanguage('All');
          }}
          className={`btn btn--sm ${activeTab === 'collaborations' ? 'btn--primary' : 'btn--secondary'}`}
        >
          Collaborations ({collaborations.length})
        </button>
      </div>

      {/* Filter and Search Bar (Shown when repositories exist in active tab) */}
      {activeRepositories.length > 0 && (
        <div className="filter-bar card card--compact mb-6">
          <div className="search-input-wrapper">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="form-input"
              placeholder={`Search ${activeTab === 'collaborations' ? 'collaborations' : 'my repositories'} by name or owner...`}
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
              <option value="All">All Languages ({activeRepositories.length})</option>
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
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)' }}>
                {selectedRepo.repoName}
              </span>
              <span className="badge badge--blue">
                {selectedRepo.primaryLanguage || 'Unspecified'}
              </span>
              <span className="badge badge--neutral">
                {selectedRepo.fullName}
              </span>
              {selectedRepo.isOwner ? (
                <span className="badge badge--green">Owned</span>
              ) : (
                <span className="badge badge--amber">Collaboration (Owner: @{selectedRepo.ownerLogin})</span>
              )}
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
                Ownership Status
              </p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)', margin: 0 }}>
                {selectedRepo.isOwner ? 'Owned by You' : `Collaborator (Owner: @${selectedRepo.ownerLogin})`}
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
          {activeRepositories.length === 0 ? (
            /* Empty State for the active tab */
            <div className="card empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <p className="empty-state__title">
                {activeTab === 'collaborations'
                  ? 'No Collaboration Repositories Found'
                  : 'No Owned Repositories Synchronized Yet'}
              </p>
              <p className="empty-state__desc">
                {activeTab === 'collaborations'
                  ? 'Repositories shared with you by other developers or organizations will appear here when you synchronize.'
                  : user?.githubUsername
                  ? `Click Sync Repositories to import repositories owned by @${user.githubUsername}.`
                  : 'Connect your GitHub account above and synchronize repositories to populate your skill evidence.'}
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
                  ownerLogin={repo.ownerLogin}
                  isOwner={repo.isOwner}
                  isFork={repo.isFork}
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
