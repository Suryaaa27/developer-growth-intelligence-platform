import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeSelector from './ThemeSelector';

/**
 * Navbar — top application bar with clean branding, responsive auth state,
 * profile trigger, and account actions dropdown.
 */
const Navbar = () => {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'settings' | null
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setActiveModal(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = user?.name || 'Developer';
  const displayEmail = user?.email || '';
  const displayRole = user?.role || 'USER';

  // Compute initials (e.g. "Jane Doe" -> "JD", "Alex" -> "AL")
  const getInitials = (name) => {
    if (!name) return 'DE';
    const parts = name.trim().split(/\s+/);
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(displayName);

  return (
    <header className="navbar">
      {/* Logo */}
      <Link to="/" className="navbar__logo">
        <div className="navbar__logo-mark">
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="8" width="3" height="7" rx="0.5" />
            <rect x="6" y="4" width="3" height="11" rx="0.5" />
            <rect x="11" y="1" width="3" height="14" rx="0.5" />
          </svg>
        </div>
        <span className="navbar__logo-text">
          Dev<span>Growth</span>
        </span>
      </Link>

      {/* Right side navigation & profile */}
      <div className="navbar__right">
        <span className="navbar__badge">Beta</span>
        <ThemeSelector />

        {!loading && !isAuthenticated && (
          <div className="navbar__auth-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <NavLink
              to="/login"
              className="btn btn--secondary btn--sm"
              style={{ textDecoration: 'none' }}
              id="nav-signin-btn"
            >
              Sign In
            </NavLink>
            <NavLink
              to="/register"
              className="btn btn--primary btn--sm"
              style={{ textDecoration: 'none' }}
              id="nav-register-btn"
            >
              Get Started
            </NavLink>
          </div>
        )}
        {!loading && isAuthenticated && (
          <div className="navbar__user-menu" ref={dropdownRef}>
            <button
              type="button"
              className="navbar__user-trigger"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              id="nav-user-menu-btn"
            >
              <div className="navbar__avatar" title={`Signed in as ${displayName}`}>
                {initials}
              </div>
              <span className="navbar__user-name">{displayName}</span>
              <svg
                className={`navbar__user-chevron ${dropdownOpen ? 'rotated' : ''}`}
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="navbar__dropdown" role="menu" id="nav-user-dropdown">
                {/* User summary header */}
                <div className="navbar__dropdown-header">
                  <div className="navbar__dropdown-user">
                    <div className="navbar__avatar navbar__avatar--dropdown">
                      {initials}
                    </div>
                    <div className="navbar__dropdown-details">
                      <p className="navbar__dropdown-name" title={displayName}>{displayName}</p>
                      <p className="navbar__dropdown-email" title={displayEmail}>{displayEmail}</p>
                      <span className="navbar__dropdown-badge">{displayRole}</span>
                    </div>
                  </div>
                </div>

                <div className="navbar__dropdown-divider" />

                {/* Dropdown Options */}
                <button
                  type="button"
                  className="navbar__dropdown-item"
                  id="nav-dropdown-profile"
                  onClick={() => {
                    setDropdownOpen(false);
                    setActiveModal('profile');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>View Profile</span>
                </button>

                <button
                  type="button"
                  className="navbar__dropdown-item"
                  id="nav-dropdown-settings"
                  onClick={() => {
                    setDropdownOpen(false);
                    setActiveModal('settings');
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Account Settings</span>
                </button>

                {displayRole === 'ADMIN' && (
                  <button
                    type="button"
                    className="navbar__dropdown-item"
                    id="nav-dropdown-admin"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/admin');
                    }}
                    style={{ color: 'var(--color-primary, #6366f1)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>Admin Portal</span>
                  </button>
                )}

                <div className="navbar__dropdown-divider" />

                <button
                  type="button"
                  className="navbar__dropdown-item navbar__dropdown-item--danger"
                  id="nav-dropdown-logout"
                  onClick={handleLogout}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Profile Modal */}
      {activeModal === 'profile' && (
        <div className="custom-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal__header">
              <div>
                <h3 className="custom-modal__title">User Profile</h3>
                <p className="custom-modal__subtitle">Verified account credentials and platform identity</p>
              </div>
              <button
                type="button"
                className="custom-modal__close"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <div className="custom-modal__body">
              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Full Name</span>
                  <span className="profile-detail-value">{displayName}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Email Address</span>
                  <span className="profile-detail-value">{displayEmail}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">User ID</span>
                  <span className="profile-detail-value">#{user?.id ?? 'N/A'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Platform Role</span>
                  <span className="profile-detail-value">
                    <span className="navbar__dropdown-badge">{displayRole}</span>
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Session Status</span>
                  <span className="profile-detail-value" style={{ color: 'var(--color-success)', fontWeight: 'var(--fw-medium)' }}>
                    ● Active Session (Verified)
                  </span>
                </div>
              </div>
            </div>
            <div className="custom-modal__footer">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setActiveModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal */}
      {activeModal === 'settings' && (
        <div className="custom-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal__header">
              <div>
                <h3 className="custom-modal__title">Account Settings</h3>
                <p className="custom-modal__subtitle">Authentication preferences and security status</p>
              </div>
              <button
                type="button"
                className="custom-modal__close"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>
            <div className="custom-modal__body">
              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Authentication Method</span>
                  <span className="profile-detail-value">JSON Web Token (JWT) Bearer</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Session Storage</span>
                  <span className="profile-detail-value">Browser Session Storage (sessionStorage)</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Membership Tier</span>
                  <span className="profile-detail-value">Developer Growth Core (Free Tier)</span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Interface Theme</span>
                  <span className="profile-detail-value">
                    <ThemeSelector />
                  </span>
                </div>
                <div className="profile-detail-item">
                  <span className="profile-detail-label">Account Security</span>
                  <span className="profile-detail-value" style={{ color: 'var(--color-success)', fontWeight: 'var(--fw-medium)' }}>
                    Bcrypt Password Hash Protected
                  </span>
                </div>
              </div>
            </div>
            <div className="custom-modal__footer">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => setActiveModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
