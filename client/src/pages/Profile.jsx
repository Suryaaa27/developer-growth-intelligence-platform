import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { rolesAPI, userAPI } from '../services/api';

const CATEGORY_ORDER = [
  'Software Development',
  'Mobile Development',
  'Data Engineering & AI',
  'DevOps & Cloud',
  'Cybersecurity',
  'QA & Testing',
  'Embedded & Systems',
  'Architecture & Specialized Engineering',
];

const Profile = () => {
  const { user, updateUser, refreshUser } = useAuth();

  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(null);

  const [selectedRole, setSelectedRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Fetch role catalog dynamically from the backend
  useEffect(() => {
    let isMounted = true;
    const fetchRoles = async () => {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const res = await rolesAPI.getAllRoles();
        if (isMounted && res?.success && Array.isArray(res?.data?.roles) && res.data.roles.length > 0) {
          setRoles(res.data.roles);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[Profile fetchRoles Error]:', err.message);
          setRolesError('Could not load dynamic role catalog from database.');
        }
      } finally {
        if (isMounted) {
          setRolesLoading(false);
        }
      }
    };

    fetchRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize selected role from user's current targetRole
  useEffect(() => {
    if (user?.targetRole) {
      setSelectedRole(user.targetRole);
    } else {
      setSelectedRole('');
    }
  }, [user?.targetRole]);

  // Group roles by standard categories
  const groupedRoles = useMemo(() => {
    const groups = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = [];
    }
    groups['Other Engineering Roles'] = [];

    for (const r of roles) {
      const cat = r.category && groups[r.category] ? r.category : 'Other Engineering Roles';
      groups[cat].push(r);
    }

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [roles]);

  // Handle saving target role changes
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!user?.id || !selectedRole) return;

    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const matchedRole = roles.find(
      (r) => r.roleName.toLowerCase() === selectedRole.toLowerCase() || String(r.id) === String(selectedRole)
    );

    const payload = {
      targetRole: matchedRole ? matchedRole.roleName : selectedRole,
      targetRoleId: matchedRole ? matchedRole.id : undefined,
    };

    try {
      const res = await userAPI.updateTargetRole(user.id, payload);
      if (res?.success) {
        const updatedName = res.data?.targetRole || payload.targetRole;
        const updatedId = res.data?.targetRoleId || payload.targetRoleId;
        updateUser({ targetRole: updatedName, targetRoleId: updatedId });
        await refreshUser();
        setSaveSuccess(`Target engineering role successfully updated to "${updatedName}".`);
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        setSaveError(res?.message || 'Failed to update target role.');
      }
    } catch (err) {
      console.error('[Profile updateTargetRole Error]:', err);
      setSaveError(err.message || 'An unexpected error occurred while saving your target role.');
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.name || 'Developer';
  const displayEmail = user?.email || 'N/A';
  const displayRole = user?.role || 'USER';
  const currentTargetRole = user?.targetRole || 'Not Selected';
  const isTargetChanged = selectedRole && selectedRole !== (user?.targetRole || '');

  return (
    <AppLayout>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="page-header">
        <h1 className="page-header__title">User Profile & Career Target</h1>
        <p className="page-header__subtitle">
          Manage your verified account credentials, connected developer identities, and primary target engineering role.
        </p>
      </div>

      {/* ── Success / Error Feedback Banners ─────────────────────────── */}
      {saveSuccess && (
        <div
          className="card mb-6"
          style={{
            borderColor: 'var(--color-success)',
            backgroundColor: 'rgba(46,160,67,0.1)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="badge badge--green" style={{ textTransform: 'uppercase' }}>Success</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{saveSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {saveError && (
        <div
          className="card mb-6"
          style={{
            borderColor: 'var(--color-danger, #f85149)',
            backgroundColor: 'rgba(218,54,51,0.1)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="badge badge--red" style={{ textTransform: 'uppercase' }}>Error</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="btn btn--secondary btn--sm"
            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Grid: Profile Info & Target Career Role ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        
        {/* Account Details Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', margin: 0 }}>
              Account Identity
            </h2>
            <span className="badge badge--neutral">{displayRole}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Full Name
              </span>
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-medium)', margin: '2px 0 0 0', color: 'var(--color-text-primary)' }}>
                {displayName}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email Address
              </span>
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-medium)', margin: '2px 0 0 0', color: 'var(--color-text-primary)' }}>
                {displayEmail}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                User ID
              </span>
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-medium)', margin: '2px 0 0 0', color: 'var(--color-text-primary)' }}>
                #{user?.id ?? 'N/A'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Current Saved Target Role
              </span>
              <div style={{ marginTop: '4px' }}>
                <span className={`badge ${user?.targetRole ? 'badge--blue' : 'badge--amber'}`} style={{ fontSize: 'var(--text-sm)' }}>
                  {currentTargetRole}
                </span>
                {!user?.targetRole && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning, #d29922)', margin: '4px 0 0 0' }}>
                    No target role is currently selected. Choose a role below to configure your learning milestones.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* GitHub Integration Card */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', margin: 0 }}>
              GitHub Connection
            </h2>
            {user?.githubUsername ? (
              <span className="badge badge--green">Connected</span>
            ) : (
              <span className="badge badge--neutral">Not Linked</span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Connected Account
              </span>
              <p style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-medium)', margin: '2px 0 0 0', color: 'var(--color-text-primary)' }}>
                {user?.githubUsername ? `@${user.githubUsername}` : 'No GitHub account linked'}
              </p>
            </div>

            <div>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Authorization Status
              </span>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '2px 0 0 0' }}>
                {user?.githubUsername
                  ? 'Your GitHub identity is securely linked to your account for repository analysis and skill extraction.'
                  : 'Link your GitHub account from the Dashboard to analyze code volume, repositories, and framework dependencies.'}
              </p>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)' }}>
              {user?.githubUsername ? (
                <div className="flex items-center gap-3">
                  <a
                    href={`https://github.com/${user.githubUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary btn--sm"
                    style={{ textDecoration: 'none' }}
                  >
                    View GitHub Profile ↗
                  </a>
                  <Link to="/repositories" className="btn btn--secondary btn--sm" style={{ textDecoration: 'none' }}>
                    View Repositories →
                  </Link>
                </div>
              ) : (
                <Link to="/" className="btn btn--primary btn--sm" style={{ textDecoration: 'none' }}>
                  Connect GitHub on Dashboard →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Target Career Role Management Card ────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-semibold)', margin: 0 }}>
            Primary Target Engineering Role
          </h2>
          <span className="badge badge--blue">Career Target</span>
        </div>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
          Your primary target engineering role establishes the benchmark used by your <strong>Learning Roadmap</strong> and overall
          skill progression. Setting this role does not restrict your flexibility: you can explore and benchmark against any other role at
          any time in <strong>Skill Gaps</strong> without affecting your saved profile target.
        </p>

        <form onSubmit={handleSaveRole}>
          <div className="form-group" style={{ maxWidth: '540px', marginBottom: 'var(--space-5)' }}>
            <label htmlFor="profile-target-role" className="form-label" style={{ fontWeight: 'var(--fw-semibold)' }}>
              Select Your Target Engineering Role:
            </label>

            <select
              id="profile-target-role"
              className="form-select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              disabled={rolesLoading && roles.length === 0}
              style={{ fontWeight: 'var(--fw-medium)' }}
            >
              <option value="">-- Choose a Target Role --</option>
              {groupedRoles.length > 0 ? (
                groupedRoles.map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((r) => (
                      <option key={r.id} value={r.roleName}>
                        {r.roleName}
                      </option>
                    ))}
                  </optgroup>
                ))
              ) : roles.length > 0 ? (
                roles.map((r) => (
                  <option key={r.id} value={r.roleName}>
                    {r.roleName}
                  </option>
                ))
              ) : (
                <option value="">Loading engineering roles...</option>
              )}
            </select>

            {rolesError && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning, #d29922)', marginTop: '4px', display: 'block' }}>
                {rolesError}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !selectedRole || (!isTargetChanged && !!user?.targetRole)}
              id="save-profile-role-btn"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
            {isTargetChanged && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                Unsaved role change: click "Save Changes" to apply.
              </span>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default Profile;

