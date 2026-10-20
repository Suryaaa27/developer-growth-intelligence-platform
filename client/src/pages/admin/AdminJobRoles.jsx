import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminAPI } from '../../services/api';

/**
 * AdminJobRoles Page
 * Target job role requirement profiles & skill benchmarks management.
 * Full CRUD: Create, View, Edit, Delete with dynamic skills builder.
 */
const AdminJobRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [search, setSearch] = useState('');

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | null
  const [selectedRole, setSelectedRole] = useState(null);
  const [deleteConfirmRole, setDeleteConfirmRole] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Role Form State
  const [formRoleName, setFormRoleName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSkills, setFormSkills] = useState([]);

  // New skill input row state
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Backend');
  const [newSkillBenchmark, setNewSkillBenchmark] = useState(80);
  const [formError, setFormError] = useState('');

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = search.trim() ? { search: search.trim() } : {};
      const response = await adminAPI.getAllRoles(params);
      if (response?.success && response?.data) {
        setRoles(response.data.roles || []);
      } else {
        setError(response?.message || 'Failed to fetch job roles.');
      }
    } catch (err) {
      console.error('[AdminJobRoles loadRoles Error]:', err);
      setError(err.message || 'Error connecting to job roles API.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setSelectedRole(null);
    setFormRoleName('');
    setFormDescription('');
    setFormSkills([
      { name: 'JavaScript', category: 'Language', benchmarkScore: 80 },
      { name: 'Node.js', category: 'Backend', benchmarkScore: 80 },
    ]);
    setNewSkillName('');
    setNewSkillCategory('Backend');
    setNewSkillBenchmark(80);
    setFormError('');
  };

  // Open Edit Modal
  const openEditModal = (role) => {
    setModalMode('edit');
    setSelectedRole(role);
    setFormRoleName(role.roleName || '');
    setFormDescription(role.description || '');
    setFormSkills(Array.isArray(role.requiredSkills) ? [...role.requiredSkills] : []);
    setNewSkillName('');
    setNewSkillCategory('Backend');
    setNewSkillBenchmark(80);
    setFormError('');
  };

  // Open View Modal
  const openViewModal = (role) => {
    setModalMode('view');
    setSelectedRole(role);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRole(null);
    setFormError('');
  };

  // Add skill to temporary form list
  const handleAddSkill = () => {
    if (!newSkillName.trim()) {
      setFormError('Please provide a skill name.');
      return;
    }
    const skillName = newSkillName.trim();
    if (formSkills.some((s) => s.name.toLowerCase() === skillName.toLowerCase())) {
      setFormError(`Skill '${skillName}' is already in the requirements list.`);
      return;
    }

    setFormSkills((prev) => [
      ...prev,
      {
        name: skillName,
        category: newSkillCategory,
        benchmarkScore: Math.min(100, Math.max(1, Number(newSkillBenchmark) || 80)),
      },
    ]);
    setNewSkillName('');
    setFormError('');
  };

  // Remove skill from temporary form list
  const handleRemoveSkill = (indexToRemove) => {
    setFormSkills((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formRoleName.trim() || formRoleName.trim().length < 2) {
      setFormError('Role Name must be at least 2 characters.');
      return;
    }

    if (formSkills.length === 0) {
      setFormError('Please add at least one required skill requirement.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        roleName: formRoleName.trim(),
        description: formDescription.trim() || null,
        requiredSkills: formSkills,
      };

      let res;
      if (modalMode === 'create') {
        res = await adminAPI.createRole(payload);
      } else {
        res = await adminAPI.updateRole(selectedRole.id, payload);
      }

      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `Job role '${payload.roleName}' successfully ${modalMode === 'create' ? 'created' : 'updated'}.`,
        });
        closeModal();
        loadRoles();
      } else {
        setFormError(res?.message || 'Failed to save job role.');
      }
    } catch (err) {
      setFormError(err.message || 'Error occurred while saving job role.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Role Deletion
  const executeDeleteRole = async () => {
    if (!deleteConfirmRole) return;
    setActionLoading(true);
    try {
      const res = await adminAPI.deleteRole(deleteConfirmRole.id);
      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `Job role '${deleteConfirmRole.roleName}' deleted successfully.`,
        });
        setDeleteConfirmRole(null);
        loadRoles();
      } else {
        setFeedback({
          type: 'error',
          message: res?.message || 'Unable to delete role.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Cannot delete role.',
      });
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
            <span>Target Job Roles</span>
            <span className="admin-badge">BENCHMARKS</span>
          </h1>
          <p className="admin-header__subtitle">
            Configure standardized role requirements and required skill expectations for gap analysis.
          </p>
        </div>
        <div className="admin-header__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={openCreateModal}
          >
            + Create Target Role
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

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div className="admin-search-input">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" color="var(--color-fg-muted)">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l4 4" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search roles or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSearch('')}>
              Clear
            </button>
          )}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
          {roles.length} role{roles.length === 1 ? '' : 's'} defined
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="card mb-4" style={{ backgroundColor: 'var(--color-danger-light)', padding: '16px' }}>
          {error}
        </div>
      )}

      {/* Table list */}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '48px' }}>#</th>
              <th>Role Profile</th>
              <th>Required Skills</th>
              <th>Last Updated</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-fg-muted)' }}>
                  Loading target job roles...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-fg-muted)' }}>
                  No target job roles defined yet. Click <strong>+ Create Target Role</strong> to establish your first role profile.
                </td>
              </tr>
            ) : (
              roles.map((r) => {
                const skillsList = Array.isArray(r.requiredSkills) ? r.requiredSkills : [];
                return (
                  <tr key={r.id}>
                    <td style={{ color: 'var(--color-fg-muted)', fontSize: '12px' }}>{r.id}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-fg-default)' }}>{r.roleName}</div>
                        {r.description && (
                          <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginTop: '2px', maxWidth: '340px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '380px' }}>
                        {skillsList.slice(0, 4).map((s, idx) => (
                          <span key={idx} className="skill-tag-chip">
                            {s.name} <span className="skill-tag-chip__score">{s.benchmarkScore}%</span>
                          </span>
                        ))}
                        {skillsList.length > 4 && (
                          <span className="skill-tag-chip" style={{ color: 'var(--color-fg-muted)' }}>
                            +{skillsList.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
                      {new Date(r.updatedAt || r.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                          onClick={() => openViewModal(r)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          style={{ padding: '3px 8px', fontSize: '12px' }}
                          onClick={() => openEditModal(r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          style={{ padding: '3px 8px', fontSize: '12px', color: 'var(--color-danger)' }}
                          onClick={() => setDeleteConfirmRole(r)}
                        >
                          Delete
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

      {/* ── View Role Details Modal ───────────────────────── */}
      {modalMode === 'view' && selectedRole && (
        <div className="custom-modal-backdrop" onClick={closeModal}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="custom-modal__header">
              <div>
                <h3 className="custom-modal__title">{selectedRole.roleName}</h3>
                <p className="custom-modal__subtitle">Target job role specifications and benchmark requirements</p>
              </div>
              <button type="button" className="custom-modal__close" onClick={closeModal}>&times;</button>
            </div>
            <div className="custom-modal__body">
              {selectedRole.description && (
                <div style={{ marginBottom: '16px' }}>
                  <span className="profile-detail-label">Role Description</span>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--color-fg-default)', lineHeight: 1.5 }}>
                    {selectedRole.description}
                  </p>
                </div>
              )}

              <div>
                <span className="profile-detail-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Required Skills &amp; Benchmarks ({selectedRole.requiredSkills?.length || 0})
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.isArray(selectedRole.requiredSkills) && selectedRole.requiredSkills.map((s, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--color-canvas-subtle, #f6f8fa)',
                        border: '1px solid var(--color-border-default, #d0d7de)',
                        borderRadius: '6px',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</span>
                        {s.category && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-fg-muted)', marginLeft: '8px' }}>
                            ({s.category})
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 100, height: 6, background: 'var(--color-border-subtle, #e1e4e8)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${s.benchmarkScore || 0}%`, height: '100%', background: 'var(--color-accent, #1f883d)' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-accent, #1f883d)', minWidth: '36px', textAlign: 'right' }}>
                          {s.benchmarkScore}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="custom-modal__footer">
              <button type="button" className="btn btn--secondary btn--sm" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Role Modal ──────────────────────── */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="custom-modal-backdrop" onClick={closeModal}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <form onSubmit={handleSubmitForm}>
              <div className="custom-modal__header">
                <div>
                  <h3 className="custom-modal__title">
                    {modalMode === 'create' ? 'Create Target Job Role' : `Edit: ${selectedRole?.roleName}`}
                  </h3>
                  <p className="custom-modal__subtitle">Define role benchmarks and required technical competencies</p>
                </div>
                <button type="button" className="custom-modal__close" onClick={closeModal}>&times;</button>
              </div>

              <div className="custom-modal__body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {formError && (
                  <div className="card mb-4" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px 14px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {/* Role Name */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 600 }}>Role Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Senior Fullstack Engineer"
                    value={formRoleName}
                    onChange={(e) => setFormRoleName(e.target.value)}
                    required
                  />
                </div>

                {/* Role Description */}
                <div className="form-group mb-4">
                  <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Summary of responsibilities and expectations for this role profile..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Required Skills Management */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Required Competencies &amp; Benchmarks *</span>
                    <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>{formSkills.length} configured</span>
                  </label>

                  {/* Add skill row */}
                  <div
                    style={{
                      background: 'var(--color-canvas-subtle, #f6f8fa)',
                      border: '1px solid var(--color-border-default, #d0d7de)',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '14px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--color-fg-muted)' }}>
                      + Add Competency Benchmark
                    </div>
                    <div className="skill-builder-row">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Skill (e.g. Docker, Python)"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                      />
                      <select
                        className="form-control"
                        value={newSkillCategory}
                        onChange={(e) => setNewSkillCategory(e.target.value)}
                      >
                        <option value="Backend">Backend</option>
                        <option value="Frontend">Frontend</option>
                        <option value="Database">Database</option>
                        <option value="DevOps">DevOps</option>
                        <option value="Language">Language</option>
                        <option value="Architecture">Architecture</option>
                        <option value="Testing">Testing</option>
                      </select>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Score"
                        min="1"
                        max="100"
                        value={newSkillBenchmark}
                        onChange={(e) => setNewSkillBenchmark(e.target.value)}
                        title="Benchmark Score (1-100)"
                      />
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={handleAddSkill}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Configured skills list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {formSkills.map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 12px',
                          background: 'var(--color-canvas-default, #ffffff)',
                          border: '1px solid var(--color-border-muted, #e1e4e8)',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{s.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-fg-muted)', background: 'var(--color-canvas-subtle)', padding: '1px 6px', borderRadius: 4 }}>
                            {s.category}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-accent)' }}>
                            {s.benchmarkScore}%
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(idx)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '14px' }}
                            title="Remove skill"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="custom-modal__footer">
                <button type="button" className="btn btn--secondary btn--sm" onClick={closeModal} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : modalMode === 'create' ? 'Create Role' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ───────────────────── */}
      {deleteConfirmRole && (
        <div className="custom-modal-backdrop" onClick={() => setDeleteConfirmRole(null)}>
          <div className="confirm-dialog__box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog__icon confirm-dialog__icon--danger">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600 }}>Delete Job Role?</h3>
            <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 20px' }}>
              Are you sure you want to permanently delete <strong>{deleteConfirmRole.roleName}</strong>?
              This role definition will no longer be available for new evaluations.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setDeleteConfirmRole(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={executeDeleteRole}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminJobRoles;
