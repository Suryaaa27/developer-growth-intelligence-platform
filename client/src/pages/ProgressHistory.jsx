import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { analysisAPI } from '../services/api';

/** Format ISO date into human-readable date + time. */
const formatDateTime = (dateString) => {
  if (!dateString) return 'Recent';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return String(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateString);
  }
};

/** Safely parse analysis_summary from snapshot */
const parseSummary = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const ProgressHistory = () => {
  const { user } = useAuth();
  const targetRole = user?.targetRole;
  const targetRoleId = user?.targetRoleId;

  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Fetch snapshots filtered for the user's saved target role
  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = {};
      if (targetRoleId) params.targetRoleId = targetRoleId;
      else if (targetRole) params.targetRole = targetRole;

      const res = await analysisAPI.getSnapshots(params);
      if (res?.success && Array.isArray(res.data)) {
        // Enforce role filter strictly: only snapshots for current target role
        const filtered = res.data.filter((s) => {
          if (targetRoleId && s.targetRoleId === targetRoleId) return true;
          if (targetRole && s.roleName && s.roleName.toLowerCase() === targetRole.toLowerCase()) return true;
          // Fallback if neither id nor name matched
          return false;
        });
        setSnapshots(filtered);
      } else {
        setSnapshots([]);
      }
    } catch (err) {
      console.error('[ProgressHistory fetch error]:', err);
      setLoadError(err.message || 'Failed to retrieve progress data.');
    } finally {
      setLoading(false);
    }
  }, [targetRoleId, targetRole]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Toggle detail accordion
  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Derive metrics for the current target role
  const latestSnapshot = useMemo(() => (snapshots.length > 0 ? snapshots[0] : null), [snapshots]);
  const oldestSnapshot = useMemo(() => (snapshots.length > 0 ? snapshots[snapshots.length - 1] : null), [snapshots]);
  const latestSummary = useMemo(() => parseSummary(latestSnapshot?.analysisSummary), [latestSnapshot]);
  const latestScore = latestSnapshot?.readinessScore != null ? latestSnapshot.readinessScore : null;

  return (
    <AppLayout>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 className="page-header__title">Progress History</h1>
            <p className="page-header__subtitle">
              Historical checkpoints and verified readiness progress for your primary target career role.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/gaps" className="btn btn--secondary btn--sm">
              Skill Gap Analysis →
            </Link>
            <Link to="/profile" className="btn btn--secondary btn--sm">
              Profile Settings
            </Link>
          </div>
        </div>
      </div>

      {/* ── Target Role Benchmark Banner ────────────────────────────── */}
      {!targetRole ? (
        <div
          className="card mb-6"
          style={{
            borderLeft: '4px solid var(--color-warning, #d29922)',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-5) var(--space-6)',
          }}
        >
          <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="badge badge--amber">No Target Role Selected</span>
                <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                  Set Your Career Target
                </span>
              </div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Progress History tracks evidence checkpoints specifically for your primary career goal. Please select your target engineering role in Profile to see your progress milestones.
              </p>
            </div>
            <Link to="/profile" className="btn btn--primary btn--sm" style={{ textDecoration: 'none' }}>
              Choose Role in Profile →
            </Link>
          </div>
        </div>
      ) : (
        <div
          className="card mb-6"
          style={{
            borderLeft: '4px solid var(--color-accent)',
            backgroundColor: 'var(--color-surface)',
            padding: 'var(--space-4) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div className="flex items-center gap-3">
            <span className="badge badge--blue">Target Role</span>
            <div>
              <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)' }}>
                {targetRole}
              </span>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Displaying historical analysis snapshots filtered strictly for this target benchmark.
              </p>
            </div>
          </div>
          <Link to="/profile" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
            Change Target in Profile →
          </Link>
        </div>
      )}

      {/* ── Current Role Overview Stat Cards ────────────────────────── */}
      {targetRole && snapshots.length > 0 && (
        <div className="grid-3 mb-6">
          <div className="stat-card">
            <p className="stat-card__label">Current Readiness Score</p>
            <div className="flex items-center gap-3" style={{ margin: '4px 0' }}>
              <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--fw-bold)', color: 'var(--color-accent)' }}>
                {latestScore != null ? `${latestScore}%` : '–'}
              </span>
              <span className={`badge ${latestScore >= 70 ? 'badge--green' : latestScore >= 40 ? 'badge--blue' : 'badge--amber'}`}>
                {latestScore >= 70 ? 'Strong Alignment' : latestScore >= 40 ? 'Moderate Signal' : 'Initial Evidence'}
              </span>
            </div>
            <p className="stat-card__meta">Latest verified coverage for {targetRole}</p>
          </div>

          <div className="stat-card">
            <p className="stat-card__label">Competencies Evidenced</p>
            <p className="stat-card__value" style={{ margin: '4px 0' }}>
              {latestSummary.matchedSkills ?? 0}
              <span style={{ fontSize: 'var(--text-md)', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>
                {' '}/ {latestSummary.totalRequired ?? 0} required
              </span>
            </p>
            <p className="stat-card__meta">
              {latestSummary.analyzedRepositories != null
                ? `Across ${latestSummary.analyzedRepositories} scanned repositories`
                : 'Observable in repository code'}
            </p>
          </div>

          <div className="stat-card">
            <p className="stat-card__label">Milestone Checkpoints</p>
            <p className="stat-card__value" style={{ margin: '4px 0' }}>
              {snapshots.length}
            </p>
            <p className="stat-card__meta">
              {oldestSnapshot ? `First checkpoint: ${formatDateTime(oldestSnapshot.createdAt)}` : 'Historical records archived'}
            </p>
          </div>
        </div>
      )}

      {/* ── Snapshots Table Section ─────────────────────────────────── */}
      <section aria-labelledby="snapshots-heading" className="reveal-on-scroll" style={{ marginBottom: 'var(--space-8)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="snapshots-heading" className="section-heading" style={{ marginBottom: 0 }}>
            {targetRole ? `Historical Snapshots for ${targetRole}` : 'Analysis Snapshots History'}
          </h2>
          {snapshots.length > 0 && (
            <span className="badge badge--neutral">
              {snapshots.length} {snapshots.length === 1 ? 'Checkpoint' : 'Checkpoints'} Recorded
            </span>
          )}
        </div>

        {loading ? (
          <div className="card p-6">
            <div className="skeleton" style={{ height: '20px', width: '30%', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '14px', width: '80%' }} />
          </div>
        ) : loadError ? (
          <div className="card p-4" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--color-danger, #f85149)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
              {loadError}
            </p>
            <button type="button" onClick={fetchSnapshots} className="btn btn--secondary btn--sm">
              Retry
            </button>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="card empty-state" style={{ padding: 'var(--space-8) var(--space-6)', textAlign: 'center' }}>
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ opacity: 0.4, margin: '0 auto var(--space-3) auto' }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <p className="empty-state__title" style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)' }}>
              {targetRole
                ? `No Historical Snapshots Recorded for ${targetRole}`
                : 'No Target Role Selected'}
            </p>
            <p className="empty-state__desc" style={{ maxWidth: '520px', margin: '0 auto var(--space-4) auto', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              {targetRole
                ? `Each time you run skill analysis, DevGrowth benchmarks your repositories and records a checkpoint for ${targetRole}. Run skill analysis to capture your first checkpoint.`
                : 'Select your target engineering role in your Profile to begin tracking role-specific progress checkpoints.'}
            </p>
            <div className="flex items-center gap-3" style={{ justifyContent: 'center' }}>
              {targetRole ? (
                <Link to="/gaps" className="btn btn--primary btn--sm" style={{ textDecoration: 'none' }}>
                  Run Skill Analysis →
                </Link>
              ) : (
                <Link to="/profile" className="btn btn--primary btn--sm" style={{ textDecoration: 'none' }}>
                  Select Target Role in Profile →
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Snapshot Date & Time</th>
                  <th style={{ width: '22%' }}>Target Role</th>
                  <th style={{ width: '18%' }}>Readiness Score</th>
                  <th style={{ width: '26%' }}>Evidence Summary</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => {
                  const summary = parseSummary(snap.analysisSummary);
                  const isExpanded = expandedId === snap.id;
                  const matchedList = summary.matchedSkillList || [];
                  const missingList = summary.missingSkillList || [];

                  return (
                    <tr key={snap.id} style={{ verticalAlign: 'top' }}>
                      <td>
                        <span style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-text-primary)', display: 'block' }}>
                          {formatDateTime(snap.createdAt)}
                        </span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                          Snapshot #{snap.id}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 'var(--fw-medium)', color: 'var(--color-text-primary)' }}>
                          {snap.roleName || targetRole}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            snap.readinessScore >= 70
                              ? 'badge--green'
                              : snap.readinessScore >= 40
                              ? 'badge--blue'
                              : 'badge--amber'
                          }`}
                          style={{ fontSize: 'var(--text-sm)' }}
                        >
                          {snap.readinessScore != null ? `${snap.readinessScore}%` : '0%'}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                          <strong>{summary.matchedSkills ?? 0}</strong> of <strong>{summary.totalRequired ?? 0}</strong> required skills evidenced
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          {summary.analyzedRepositories != null
                            ? `${summary.analyzedRepositories} repos scanned • ${summary.distinctSkillsDetected ?? 0} skills detected`
                            : 'Verified repository evidence'}
                        </div>

                        {/* Collapsible Details */}
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: 'var(--space-3)',
                              padding: 'var(--space-3)',
                              backgroundColor: 'var(--color-surface-2, rgba(255,255,255,0.04))',
                              borderRadius: '6px',
                            }}
                          >
                            <div style={{ marginBottom: 'var(--space-2)' }}>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-success)', display: 'block', marginBottom: '4px' }}>
                                ✓ Evidenced Skills ({matchedList.length}):
                              </span>
                              {matchedList.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {matchedList.map((skill) => (
                                    <span key={skill} className="badge badge--green" style={{ fontSize: '11px' }}>
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                                  No required skills evidenced in this scan.
                                </span>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--color-warning)', display: 'block', marginBottom: '4px' }}>
                                ⚠ Missing Signals ({missingList.length}):
                              </span>
                              {missingList.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {missingList.map((skill) => (
                                    <span key={skill} className="badge badge--neutral" style={{ fontSize: '11px' }}>
                                      {skill}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)' }}>
                                  All required competencies evidenced!
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => toggleExpand(snap.id)}
                          className="btn btn--secondary btn--sm"
                          style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? '▲ Hide' : '▼ Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  );
};

export default ProgressHistory;
