import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

/**
 * AdminUsers Page
 * Complete user management: paginated list, search, status & role filters,
 * detailed profile inspection, and guarded account activation / role modification.
 */
const AdminUsers = () => {
  const { user: currentAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Active Modals & Dialogs
  const [selectedUser, setSelectedUser] = useState(null); // For details modal
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null); // { type: 'status' | 'role', user: {}, newStatus?: boolean, newRole?: string }

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit: pagination.limit,
      };
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      if (statusFilter !== '') params.isActive = statusFilter;

      const response = await adminAPI.getAllUsers(params);
      if (response?.success && response?.data) {
        setUsers(response.data.users || []);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setError(response?.message || 'Failed to fetch user list.');
      }
    } catch (err) {
      console.error('[AdminUsers loadUsers Error]:', err);
      setError(err.message || 'Error connecting to user management API.');
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, search, roleFilter, statusFilter]);

  useEffect(() => {
    loadUsers(1);
  }, [roleFilter, statusFilter, loadUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadUsers(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setTimeout(() => loadUsers(1), 0);
  };

  // View User Details
  const handleViewDetails = async (userId) => {
    setDetailsLoading(true);
    setSelectedUser(null);
    try {
      const res = await adminAPI.getUserById(userId);
      if (res?.success && res?.data?.user) {
        setSelectedUser(res.data.user);
      } else {
        setFeedback({ type: 'error', message: res?.message || 'Failed to load user details.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Error fetching user details.' });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Execute Confirmed Status Change
  const executeStatusChange = async () => {
    if (!confirmDialog || confirmDialog.type !== 'status') return;
    const { user, newStatus } = confirmDialog;
    setActionLoading(true);
    try {
      const res = await adminAPI.updateUserStatus(user.id, newStatus);
      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `User '${user.name}' has been successfully ${newStatus ? 'activated' : 'deactivated'}.`,
        });
        setConfirmDialog(null);
        loadUsers(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res?.message || 'Failed to update user status.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user status.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Confirmed Role Change
  const executeRoleChange = async () => {
    if (!confirmDialog || confirmDialog.type !== 'role') return;
    const { user, newRole } = confirmDialog;
    setActionLoading(true);
    try {
      const res = await adminAPI.updateUserRole(user.id, newRole);
      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `Role for '${user.name}' has been changed to ${newRole}.`,
        });
        setConfirmDialog(null);
        loadUsers(pagination.page);
      } else {
        setFeedback({ type: 'error', message: res?.message || 'Failed to update user role.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user role.' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__title-group">
          <h1 className="admin-header__title">
            <span>User Management</span>
            <span className="admin-badge">REGISTRY</span>
          </h1>
          <p className="admin-header__subtitle">
            Search, inspect, and manage authorization roles and account status for all platform users.
          </p>
        </div>
        <div className="admin-header__actions">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => loadUsers(pagination.page)}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications banner */}
      {feedback && (
        <div
          className="card mb-4"
          style={{
            backgroundColor: feedback.type === 'success' ? 'var(--color-accent-light, #dafbe1)' : 'var(--color-danger-light, #ffebe9)',
            borderColor: feedback.type === 'success' ? 'var(--color-accent-border, #4ac26b)' : 'var(--color-danger-border, #ff8182)',
            color: feedback.type === 'success' ? 'var(--color-accent-fg, #1a7f37)' : 'var(--color-danger, #cf222e)',
            padding: '12px 16px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div className="admin-toolbar">
        <form onSubmit={handleSearchSubmit} className="admin-toolbar__filters">
          {/* Search Input */}
          <div className="admin-search-input">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" color="var(--color-fg-muted)">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l4 4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <select
            className="admin-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          {/* Status Filter */}
          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>

          <button type="submit" className="btn btn--secondary btn--sm">
            Search
          </button>

          {(search || roleFilter || statusFilter) && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleClearFilters}>
              Clear
            </button>
          )}
        </form>

        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
          {pagination.total} user{pagination.total === 1 ? '' : 's'} registered
        </span>
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
          }}
        >
          {error}
        </div>
      )}

      {/* Data Table */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>#</th>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-fg-muted)' }}>
                  Loading registered users...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--color-fg-muted)' }}>
                  No users found matching current filters.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === currentAdmin?.id;
                return (
                  <tr key={u.id}>
                    <td style={{ color: 'var(--color-fg-muted)', fontSize: '12px' }}>{u.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: u.role === 'ADMIN' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(140, 149, 159, 0.2)',
                            color: u.role === 'ADMIN' ? '#6366f1' : 'var(--color-fg-default)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '11px',
                          }}
                        >
                          {u.name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <span style={{ fontWeight: 600 }}>
                          {u.name} {isSelf && <span style={{ fontSize: '11px', color: 'var(--color-accent)' }}>(You)</span>}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-fg-muted)' }}>{u.email}</td>
                    <td>
                      <span className={u.role === 'ADMIN' ? 'badge-role-admin' : 'badge-role-user'}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={u.isActive ? 'badge-status-active' : 'badge-status-inactive'}>
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Details */}
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                          onClick={() => handleViewDetails(u.id)}
                        >
                          View
                        </button>

                        {/* Status Toggle (Deactivate / Activate) */}
                        <button
                          type="button"
                          className={`btn btn--sm ${u.isActive ? 'btn--ghost' : 'btn--secondary'}`}
                          style={{
                            padding: '3px 8px',
                            fontSize: '12px',
                            color: u.isActive ? 'var(--color-danger)' : 'var(--color-accent)',
                          }}
                          disabled={isSelf && u.isActive}
                          title={isSelf ? 'Cannot deactivate your own account' : ''}
                          onClick={() =>
                            setConfirmDialog({
                              type: 'status',
                              user: u,
                              newStatus: !u.isActive,
                            })
                          }
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>

                        {/* Role Change (USER <-> ADMIN) */}
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                          disabled={isSelf && u.role === 'ADMIN'}
                          title={isSelf ? 'Cannot demote your own admin account' : ''}
                          onClick={() =>
                            setConfirmDialog({
                              type: 'role',
                              user: u,
                              newRole: u.role === 'ADMIN' ? 'USER' : 'ADMIN',
                            })
                          }
                        >
                          {u.role === 'ADMIN' ? 'Make User' : 'Make Admin'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="admin-pagination">
          <span>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <div className="admin-pagination__buttons">
            <button
              type="button"
              className="admin-pagination__btn"
              disabled={pagination.page <= 1}
              onClick={() => loadUsers(pagination.page - 1)}
            >
              Previous
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={`admin-pagination__btn ${pagination.page === p ? 'admin-pagination__btn--active' : ''}`}
                onClick={() => loadUsers(p)}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className="admin-pagination__btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadUsers(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── User Details Modal ────────────────────────────── */}
      {(selectedUser || detailsLoading) && (
        <div className="custom-modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="custom-modal__header">
              <div>
                <h3 className="custom-modal__title">User Account Details</h3>
                <p className="custom-modal__subtitle">Verified MySQL user record and platform usage</p>
              </div>
              <button
                type="button"
                className="custom-modal__close"
                onClick={() => setSelectedUser(null)}
              >
                &times;
              </button>
            </div>
            <div className="custom-modal__body">
              {detailsLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--color-fg-muted)' }}>Loading details...</p>
              ) : selectedUser ? (
                <div className="profile-details-grid">
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">User ID</span>
                    <span className="profile-detail-value">#{selectedUser.id}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Full Name</span>
                    <span className="profile-detail-value">{selectedUser.name}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Email Address</span>
                    <span className="profile-detail-value">{selectedUser.email}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Role</span>
                    <span className="profile-detail-value">
                      <span className={selectedUser.role === 'ADMIN' ? 'badge-role-admin' : 'badge-role-user'}>
                        {selectedUser.role}
                      </span>
                    </span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Account Status</span>
                    <span className="profile-detail-value">
                      <span className={selectedUser.isActive ? 'badge-status-active' : 'badge-status-inactive'}>
                        {selectedUser.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Repositories Synced</span>
                    <span className="profile-detail-value">{selectedUser.repositoryCount ?? 0}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Analysis Snapshots</span>
                    <span className="profile-detail-value">{selectedUser.analysisSnapshotCount ?? 0}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Created At</span>
                    <span className="profile-detail-value">{new Date(selectedUser.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Last Updated</span>
                    <span className="profile-detail-value">{new Date(selectedUser.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="custom-modal__footer">
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation Dialog Modal ──────────────────────── */}
      {confirmDialog && (
        <div className="custom-modal-backdrop" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog__box" onClick={(e) => e.stopPropagation()}>
            <div
              className={`confirm-dialog__icon ${confirmDialog.type === 'status' && !confirmDialog.newStatus ? 'confirm-dialog__icon--danger' : 'confirm-dialog__icon--warning'}`}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600 }}>
              {confirmDialog.type === 'status'
                ? confirmDialog.newStatus
                  ? 'Activate User Account?'
                  : 'Deactivate User Account?'
                : `Change Role to ${confirmDialog.newRole}?`}
            </h3>

            <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 20px' }}>
              {confirmDialog.type === 'status' ? (
                confirmDialog.newStatus ? (
                  <>Are you sure you want to reactivate access for <strong>{confirmDialog.user.name}</strong> ({confirmDialog.user.email})?</>
                ) : (
                  <>
                    Are you sure you want to deactivate <strong>{confirmDialog.user.name}</strong>?
                    They will immediately be blocked from protected endpoints and login.
                  </>
                )
              ) : (
                <>
                  Are you sure you want to change the platform role of <strong>{confirmDialog.user.name}</strong> to <strong>{confirmDialog.newRole}</strong>?
                </>
              )}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn btn--sm ${confirmDialog.type === 'status' && !confirmDialog.newStatus ? 'btn--danger' : 'btn--primary'}`}
                onClick={confirmDialog.type === 'status' ? executeStatusChange : executeRoleChange}
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminUsers;
