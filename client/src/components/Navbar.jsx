import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import ThemeSelector from './ThemeSelector';
import Logo from './Logo';
import {
  ChevronDownIcon,
  PersonIcon,
  GearIcon,
  ShieldIcon,
  SignOutIcon,
  XIcon,
} from './icons';

/**
 * Navbar — top application bar with clean branding, responsive auth state,
 * profile trigger, and account actions dropdown.
 */
const Navbar = ({ showSidebarToggle = true }) => {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { isCollapsed, isMobileOpen, toggleSidebar } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'profile' | 'settings' | null
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const shouldShowToggle = showSidebarToggle && !isAuthPage;

  // Ensure body scroll is unlocked on auth pages
  useEffect(() => {
    if (isAuthPage) {
      document.body.style.overflow = '';
    }
  }, [isAuthPage]);

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
      {/* Left: Hamburger + Logo */}
      <div className="navbar__left">
        {shouldShowToggle && (
          <button
            type="button"
            className={`icon-btn hamburger ${isMobileOpen ? 'open' : ''}`}
            aria-label="Toggle sidebar"
            aria-expanded={isMobileOpen || !isCollapsed}
            aria-controls="app-sidebar"
            onClick={toggleSidebar}
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        )}

        <Link to="/" className="navbar__logo" aria-label="DevGrowth Home">
          <Logo variant="full" size={32} />
        </Link>
      </div>

      {/* Right side navigation & profile */}
      <div className="navbar__right">
        <span className="navbar__badge">Beta</span>
        <ThemeSelector />

        {!loading && !isAuthenticated && (
          <div className="navbar__auth-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <NavLink
              to="/login"
              className="btn btn--secondary btn--sm"
              id="nav-signin-btn"
            >
              Sign In
            </NavLink>
            <NavLink
              to="/register"
              className="btn btn--primary btn--sm"
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
              <ChevronDownIcon
                className={`navbar__user-chevron ${dropdownOpen ? 'rotated' : ''}`}
                size={14}
              />
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
                    navigate('/profile');
                  }}
                >
                  <PersonIcon size={16} />
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
                  <GearIcon size={16} />
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
                    <ShieldIcon size={16} />
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
                  <SignOutIcon size={16} />
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
                <XIcon size={16} />
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
                <XIcon size={16} />
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
