import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminAPI } from '../../services/api';

/**
 * AdminTemplates Page
 * Curated growth and learning recommendation templates management.
 * Full CRUD: Create, View, Edit, Delete with skill name, title, description,
 * resource URL, and priority levels.
 */
const AdminTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');

  // Modals state
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | 'view' | null
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form fields
  const [formSkillName, setFormSkillName] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formResourceUrl, setFormResourceUrl] = useState('');
  const [formPriority, setFormPriority] = useState('MEDIUM');
  const [formError, setFormError] = useState('');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (priorityFilter) params.priority = priorityFilter;
      if (skillFilter.trim()) params.skillName = skillFilter.trim();

      const response = await adminAPI.getAllTemplates(params);
      if (response?.success && response?.data) {
        setTemplates(response.data.templates || []);
      } else {
        setError(response?.message || 'Failed to fetch recommendation templates.');
      }
    } catch (err) {
      console.error('[AdminTemplates loadTemplates Error]:', err);
      setError(err.message || 'Error connecting to templates API.');
    } finally {
      setLoading(false);
    }
  }, [search, priorityFilter, skillFilter]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setSelectedRole(null);
    setFormSkillName('');
    setFormTitle('');
    setFormDescription('');
    setFormResourceUrl('');
    setFormPriority('MEDIUM');
    setFormError('');
  };

  // Open Edit Modal
  const openEditModal = (template) => {
    setModalMode('edit');
    setSelectedTemplate(template);
    setFormSkillName(template.skillName || '');
    setFormTitle(template.title || '');
    setFormDescription(template.description || '');
    setFormResourceUrl(template.resourceUrl || '');
    setFormPriority(template.priority || 'MEDIUM');
    setFormError('');
  };

  // Open View Modal
  const openViewModal = (template) => {
    setModalMode('view');
    setSelectedTemplate(template);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedTemplate(null);
    setFormError('');
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formSkillName.trim()) {
      setFormError('Skill Name is required.');
      return;
    }

    if (!formTitle.trim() || formTitle.trim().length < 2) {
      setFormError('Title must be at least 2 characters.');
      return;
    }

    if (!formDescription.trim() || formDescription.trim().length < 5) {
      setFormError('Description must be at least 5 characters.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        skillName: formSkillName.trim(),
        title: formTitle.trim(),
        description: formDescription.trim(),
        resourceUrl: formResourceUrl.trim() || null,
        priority: formPriority,
      };

      let res;
      if (modalMode === 'create') {
        res = await adminAPI.createTemplate(payload);
      } else {
        res = await adminAPI.updateTemplate(selectedTemplate.id, payload);
      }

      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `Recommendation template '${payload.title}' successfully ${modalMode === 'create' ? 'created' : 'updated'}.`,
        });
        closeModal();
        loadTemplates();
      } else {
        setFormError(res?.message || 'Failed to save template.');
      }
    } catch (err) {
      setFormError(err.message || 'Error occurred while saving template.');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Template Deletion
  const executeDeleteTemplate = async () => {
    if (!deleteConfirmTemplate) return;
    setActionLoading(true);
    try {
      const res = await adminAPI.deleteTemplate(deleteConfirmTemplate.id);
      if (res?.success) {
        setFeedback({
          type: 'success',
          message: `Recommendation template '${deleteConfirmTemplate.title}' deleted successfully.`,
        });
        setDeleteConfirmTemplate(null);
        loadTemplates();
      } else {
        setFeedback({
          type: 'error',
          message: res?.message || 'Unable to delete template.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Cannot delete template.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'badge-priority-critical';
      case 'HIGH':
        return 'badge-priority-high';
      case 'MEDIUM':
        return 'badge-priority-medium';
      case 'LOW':
      default:
        return 'badge-priority-low';
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="admin-header">
        <div className="admin-header__title-group">
          <h1 className="admin-header__title">
            <span>Recommendation Templates</span>
            <span className="admin-badge">GROWTH LIBRARY</span>
          </h1>
          <p className="admin-header__subtitle">
            Curate reusable learning modules and actionable recommendations linked to target skills.
          </p>
        </div>
        <div className="admin-header__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={openCreateModal}
          >
            + Create Template
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
              placeholder="Search title, skill, or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="admin-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {(search || priorityFilter || skillFilter) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setSearch('');
                setPriorityFilter('');
                setSkillFilter('');
              }}
            >
              Clear
            </button>
          )}
        </div>
        <span style={{ fontSize: '12px', color: 'var(--color-fg-muted)' }}>
          {templates.length} template{templates.length === 1 ? '' : 's'} available
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
              <th>Skill</th>
              <th>Title &amp; Summary</th>
              <th>Priority</th>
              <th>Resource</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-fg-muted)' }}>
                  Loading recommendation templates...
                </td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-fg-muted)' }}>
                  No recommendation templates found. Click <strong>+ Create Template</strong> to add guidance for detected skills.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--color-fg-muted)', fontSize: '12px' }}>{t.id}</td>
                  <td>
                    <span className="skill-tag-chip" style={{ fontWeight: 600 }}>
                      {t.skillName}
                    </span>
                  </td>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--color-fg-default)' }}>{t.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-fg-muted)', marginTop: '2px', maxWidth: '380px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={getPriorityBadgeClass(t.priority)}>
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    {t.resourceUrl ? (
                      <a
                        href={t.resourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-link)' }}
                        title={t.resourceUrl}
                      >
                        Documentation ↗
                      </a>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--color-fg-subtle)' }}>None</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        style={{ padding: '3px 8px', fontSize: '12px' }}
                        onClick={() => openViewModal(t)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        style={{ padding: '3px 8px', fontSize: '12px' }}
                        onClick={() => openEditModal(t)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        style={{ padding: '3px 8px', fontSize: '12px', color: 'var(--color-danger)' }}
                        onClick={() => setDeleteConfirmTemplate(t)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── View Template Modal ───────────────────────────── */}
      {modalMode === 'view' && selectedTemplate && (
        <div className="custom-modal-backdrop" onClick={closeModal}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="custom-modal__header">
              <div>
                <h3 className="custom-modal__title">{selectedTemplate.title}</h3>
                <p className="custom-modal__subtitle">Curated learning guidance for {selectedTemplate.skillName}</p>
              </div>
              <button type="button" className="custom-modal__close" onClick={closeModal}>&times;</button>
            </div>
            <div className="custom-modal__body">
              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Target Skill</span>
                  <span className="profile-detail-value">
                    <span className="skill-tag-chip" style={{ fontWeight: 600 }}>{selectedTemplate.skillName}</span>
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Priority Level</span>
                  <span className="profile-detail-value">
                    <span className={getPriorityBadgeClass(selectedTemplate.priority)}>
                      {selectedTemplate.priority}
                    </span>
                  </span>
                </div>
                <div className="profile-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="profile-detail-label">Recommendation Guidance</span>
                  <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--color-fg-default)', lineHeight: 1.6 }}>
                    {selectedTemplate.description}
                  </p>
                </div>
                {selectedTemplate.resourceUrl && (
                  <div className="profile-detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="profile-detail-label">External Learning Resource</span>
                    <a
                      href={selectedTemplate.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--color-link)', wordBreak: 'break-all', fontSize: '0.85rem' }}
                    >
                      {selectedTemplate.resourceUrl} ↗
                    </a>
                  </div>
                )}
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Created At</span>
                  <span className="profile-detail-value">{new Date(selectedTemplate.createdAt).toLocaleString()}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Last Updated</span>
                  <span className="profile-detail-value">{new Date(selectedTemplate.updatedAt).toLocaleString()}</span>
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

      {/* ── Create / Edit Template Modal ──────────────────── */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="custom-modal-backdrop" onClick={closeModal}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <form onSubmit={handleSubmitForm}>
              <div className="custom-modal__header">
                <div>
                  <h3 className="custom-modal__title">
                    {modalMode === 'create' ? 'Create Recommendation Template' : 'Edit Template'}
                  </h3>
                  <p className="custom-modal__subtitle">Curate actionable guidance for skill development</p>
                </div>
                <button type="button" className="custom-modal__close" onClick={closeModal}>&times;</button>
              </div>

              <div className="custom-modal__body">
                {formError && (
                  <div className="card mb-4" style={{ backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)', padding: '10px 14px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  {/* Skill Name */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Target Skill *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Docker, TypeScript, React"
                      value={formSkillName}
                      onChange={(e) => setFormSkillName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Priority */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Priority</label>
                    <select
                      className="form-control"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>
                </div>

                {/* Title */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 600 }}>Recommendation Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Implement Multi-Stage Docker Builds"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Description */}
                <div className="form-group mb-3">
                  <label className="form-label" style={{ fontWeight: 600 }}>Guidance &amp; Action Plan *</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Detailed steps for the developer to achieve competency in this skill..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    required
                  />
                </div>

                {/* Resource URL */}
                <div className="form-group mb-2">
                  <label className="form-label" style={{ fontWeight: 600 }}>Documentation / Course URL (Optional)</label>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="https://docs.docker.com/develop/..."
                    value={formResourceUrl}
                    onChange={(e) => setFormResourceUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="custom-modal__footer">
                <button type="button" className="btn btn--secondary btn--sm" onClick={closeModal} disabled={actionLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : modalMode === 'create' ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ───────────────────── */}
      {deleteConfirmTemplate && (
        <div className="custom-modal-backdrop" onClick={() => setDeleteConfirmTemplate(null)}>
          <div className="confirm-dialog__box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-dialog__icon confirm-dialog__icon--danger">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', fontWeight: 600 }}>Delete Recommendation Template?</h3>
            <p style={{ color: 'var(--color-fg-muted)', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 20px' }}>
              Are you sure you want to permanently delete template <strong>{deleteConfirmTemplate.title}</strong>?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => setDeleteConfirmTemplate(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={executeDeleteTemplate}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminTemplates;
