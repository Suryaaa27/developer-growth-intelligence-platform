import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { analysisAPI, skillsAPI } from '../services/api';

/** Format ISO date into human-readable date. */
const formatDate = (dateString) => {
  if (!dateString) return 'Recent';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(dateString);
  }
};

const ProgressHistory = () => {
  const [snapshots, setSnapshots] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [snapRes, skillsRes] = await Promise.allSettled([
        analysisAPI.getSnapshots(),
        skillsAPI.getUserSkills(),
      ]);

      if (snapRes.status === 'fulfilled' && snapRes.value?.success) {
        setSnapshots(Array.isArray(snapRes.value.data) ? snapRes.value.data : []);
      }
      if (skillsRes.status === 'fulfilled' && skillsRes.value?.success) {
        const raw = Array.isArray(skillsRes.value.data) ? skillsRes.value.data : [];
        setSkills(raw);
      }
    } catch (err) {
      console.error('[ProgressHistory fetch error]:', err);
      setLoadError(err.message || 'Failed to retrieve progress data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived current metrics from live data
  const reposCount = new Set(skills.flatMap((s) => s.contributingRepositories || [])).size;
  const lastAnalysis = skills.length > 0 ? skills[0].lastDetectedAt : null;

  return (
    <AppLayout>
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Progress History</h1>
            <p className="page-header__subtitle">
              Historical record of your code analysis snapshots, repository evidence trends, and milestones.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/skills" className="btn btn--secondary btn--sm">
              Live Skill Evidence →
            </Link>
          </div>
        </div>
      </div>

      {/* Feature Transparency Banner */}
      <div
        className="card mb-6"
        style={{
          borderLeft: '4px solid var(--color-accent)',
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--space-5) var(--space-6)',
        }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 'var(--space-1)' }}>
          <span className="badge badge--blue" style={{ textTransform: 'uppercase' }}>Milestone Notice</span>
          <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
            About Snapshot Tracking
          </span>
        </div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Historical snapshot tracking records periodic checkpoints of your repository evidence. Rather than displaying
          simulated historical timelines, DevGrowth reflects your verified current evidence below and archives new snapshots
          as skill analysis milestones are completed.
        </p>
      </div>

      {/* Current Real Summary Metrics */}
      <div className="grid-3 mb-6">
        <div className="stat-card">
          <p className="stat-card__label">Active Skills Detected</p>
          <p className="stat-card__value">{loading ? '–' : skills.length}</p>
          <p className="stat-card__meta">Across your synchronized repositories</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Contributing Repositories</p>
          <p className="stat-card__value">{loading ? '–' : reposCount}</p>
          <p className="stat-card__meta">Providing observable code signals</p>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Latest Analysis Timestamp</p>
          <p className="stat-card__value" style={{ fontSize: 'var(--text-xl)' }}>
            {loading ? '–' : lastAnalysis ? formatDate(lastAnalysis) : 'None'}
          </p>
          <p className="stat-card__meta">Most recent evidence scan</p>
        </div>
      </div>

      {/* Snapshots Section */}
      <section aria-labelledby="snapshots-heading" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="snapshots-heading" className="section-heading" style={{ marginBottom: 0 }}>
            Analysis Snapshots History
          </h2>
          <span className="badge badge--neutral">
            {snapshots.length} {snapshots.length === 1 ? 'Snapshot' : 'Snapshots'} Recorded
          </span>
        </div>

        {loading ? (
          <div className="card p-6" style={{ opacity: 0.6 }}>
            <div style={{ height: '20px', width: '30%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '14px', width: '80%', backgroundColor: 'var(--color-surface-2)', borderRadius: '4px' }} />
          </div>
        ) : loadError ? (
          <div className="card p-4" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-danger, #f85149)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              {loadError}
            </p>
            <button type="button" onClick={fetchData} className="btn btn--secondary btn--sm">
              Retry
            </button>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="card empty-state" style={{ padding: 'var(--space-8) var(--space-6)' }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, marginBottom: 'var(--space-3)' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="empty-state__title">No Historical Snapshots Recorded Yet</p>
            <p className="empty-state__desc" style={{ maxWidth: '440px' }}>
              Historical snapshots are captured each time a milestone analysis is finalized. Run skill analysis to populate your current skill profile.
            </p>
            <div className="flex items-center gap-3 mt-4" style={{ justifyContent: 'center' }}>
              <Link to="/skills" className="btn btn--primary btn--sm">
                Go to Skill Analysis
              </Link>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Snapshot Date</th>
                  <th style={{ width: '25%' }}>Target Role</th>
                  <th style={{ width: '25%' }}>Readiness Score</th>
                  <th style={{ width: '25%' }}>Summary</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => (
                  <tr key={snap.id}>
                    <td>
                      <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)' }}>
                        {formatDate(snap.createdAt)}
                      </span>
                    </td>
                    <td>{snap.roleName || `Role #${snap.targetRoleId}`}</td>
                    <td>
                      <span className="badge badge--blue">
                        {snap.readinessScore != null ? `${snap.readinessScore}%` : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {typeof snap.analysisSummary === 'object'
                          ? JSON.stringify(snap.analysisSummary)
                          : String(snap.analysisSummary || 'Snapshot recorded')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
};

export default ProgressHistory;
