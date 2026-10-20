import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminAPI } from '../../services/api';

/**
 * AdminOverview Page
 * Displays real-time platform metrics, user distribution, repository activity,
 * and quick access to administrative tools.
 */
const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminAPI.getStats();
      if (response?.success && response?.data) {
        setStats(response.data);
      } else {
        setError(response?.message || 'Failed to load platform statistics.');
      }
    } catch (err) {
      console.error('[AdminOverview fetchStats Error]:', err);
      setError(err.message || 'Unable to connect to administration service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <AdminLayout>
      <div className="admin-header">
        <div className="admin-header__title-group">
          <h1 className="admin-header__title">
            <span>Platform Overview</span>
            <span className="admin-badge">LIVE METRICS</span>
          </h1>
          <p className="admin-header__subtitle">
            System activity, user registry health, and benchmark coverage statistics.
          </p>
        </div>
        <div className="admin-header__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M1 1v5h5M15 15v-5h-5" />
              <path d="M3.51 9a6 6 0 0 0 9.77 2.11L15 10M1.23 6a6 6 0 0 1 9.77-2.11L15 5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="card mb-6"
          style={{
            backgroundColor: 'var(--color-danger-light, #ffebe9)',
            borderColor: 'var(--color-danger-border, #ff8182)',
            color: 'var(--color-danger, #cf222e)',
            padding: '16px',
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
            <button type="button" className="btn btn--secondary btn--sm" onClick={fetchStats}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="admin-stats-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="admin-stat-card" style={{ opacity: 0.6 }}>
              <div style={{ height: 16, width: '40%', background: 'var(--color-border-subtle, #e1e4e8)', borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 32, width: '60%', background: 'var(--color-border-subtle, #e1e4e8)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      )}

      {/* Loaded Stats Grid */}
      {!loading && stats && (
        <>
          <div className="admin-stats-grid">
            {/* Total Users */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Total Registered</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.totalUsers}</div>
              <div className="admin-stat-card__subtext">
                {stats.regularUsers} regular · {stats.adminUsers} admin
              </div>
            </div>

            {/* Active Accounts */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Active Accounts</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(31, 136, 61, 0.12)', color: '#1f883d' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.activeUsers}</div>
              <div className="admin-stat-card__subtext">
                {stats.inactiveUsers > 0 ? `${stats.inactiveUsers} inactive / deactivated` : '100% active standing'}
              </div>
            </div>

            {/* Repositories Synchronized */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Repositories</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(9, 105, 218, 0.12)', color: '#0969da' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.repositoryCount}</div>
              <div className="admin-stat-card__subtext">Synced user codebases</div>
            </div>

            {/* Readiness Assessments */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Assessments Run</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(217, 119, 6, 0.12)', color: '#d97706' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.analysisCount}</div>
              <div className="admin-stat-card__subtext">Role readiness snapshots</div>
            </div>

            {/* Target Job Roles */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Target Job Roles</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.jobRolesCount}</div>
              <div className="admin-stat-card__subtext">Standardized benchmarks</div>
            </div>

            {/* Recommendation Templates */}
            <div className="admin-stat-card">
              <div className="admin-stat-card__header">
                <span className="admin-stat-card__label">Curated Templates</span>
                <div className="admin-stat-card__icon" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
              </div>
              <div className="admin-stat-card__value">{stats.recommendationTemplatesCount}</div>
              <div className="admin-stat-card__subtext">Reusable growth guidance</div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
            {/* User Registry Card */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>User Registry & Security</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>Search users, update roles, toggle account access</p>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-subtle)', lineHeight: 1.5, marginBottom: '16px' }}>
                Manage registered developers, review access states, and ensure proper role distribution.
              </p>
              <Link to="/admin/users" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
                Manage Users →
              </Link>
            </div>

            {/* Target Job Roles Card */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Job Role Benchmarks</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>Define engineering roles & skill expectations</p>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-subtle)', lineHeight: 1.5, marginBottom: '16px' }}>
                Create and adjust role requirement profiles and required skill benchmarks used in readiness scoring.
              </p>
              <Link to="/admin/roles" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
                Configure Roles →
              </Link>
            </div>

            {/* Recommendation Templates Card */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Growth Templates</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-fg-muted)' }}>Curated learning and skill gap guidance</p>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-fg-subtle)', lineHeight: 1.5, marginBottom: '16px' }}>
                Maintain reusable growth recommendation templates with documentation links and priority levels.
              </p>
              <Link to="/admin/templates" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
                Manage Templates →
              </Link>
            </div>
          </div>

          {/* System Security & RBAC Status Box */}
          <div
            className="card"
            style={{
              padding: '18px 24px',
              borderLeft: '4px solid var(--color-accent, #1f883d)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1f883d', boxShadow: '0 0 0 3px rgba(31, 136, 61, 0.2)' }} />
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-fg-default)' }}>
                  Backend RBAC Security Boundary Active
                </span>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-fg-muted)' }}>
                  JWT Bearer authentication &amp; role verification are enforced on all <code>/api/admin/*</code> routes.
                </p>
              </div>
            </div>
            <span className="badge-status-active">
              SECURE &amp; VERIFIED
            </span>
          </div>
        </>
      )}
    </AdminLayout>
  );
};

export default AdminOverview;
