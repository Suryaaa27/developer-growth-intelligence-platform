import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * AdminSidebar — Dedicated navigation sidebar for the Admin Portal
 * Kept completely distinct from the Developer Dashboard sidebar.
 */
const ADMIN_NAV_ITEMS = [
  {
    section: 'Administration',
    items: [
      {
        label: 'Overview',
        href: '/admin',
        end: true,
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        ),
      },
      {
        label: 'Users',
        href: '/admin/users',
        end: false,
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M11 14v-1.5a2.5 2.5 0 0 0-2.5-2.5h-5A2.5 2.5 0 0 0 1 12.5V14" />
            <circle cx="6" cy="4.5" r="2.5" />
            <path d="M15 14v-1a2.5 2.5 0 0 0-2-2.45" />
            <path d="M11.5 2.1a2.5 2.5 0 0 1 0 4.8" />
          </svg>
        ),
      },
      {
        label: 'Job Roles',
        href: '/admin/roles',
        end: false,
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="12" height="10" rx="1.5" />
            <path d="M5 4V2.5A1.5 1.5 0 0 1 6.5 1h3A1.5 1.5 0 0 1 11 2.5V4" />
            <path d="M2 8h12" />
          </svg>
        ),
      },
      {
        label: 'Recommendation Templates',
        href: '/admin/templates',
        end: false,
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" />
            <path d="M5 6h6M5 9h6M5 12h3" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
];

const AdminSidebar = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="admin-sidebar__header">
        <span className="admin-sidebar__title">Admin Portal</span>
        <span className="admin-badge">ADMIN</span>
      </div>

      {ADMIN_NAV_ITEMS.map((group) => (
        <div key={group.section}>
          <ul className="sidebar__nav">
            {group.items.map((item) => (
              <li key={item.label} className="sidebar__nav-item">
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar__nav-link${isActive ? ' active' : ''}`
                  }
                >
                  <span className="sidebar__nav-icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="sidebar__divider" />

      {/* Switch to Developer Portal */}
      <div style={{ marginTop: 'auto' }}>
        <p className="sidebar__section-label">Portal Switcher</p>
        <ul className="sidebar__nav">
          <li className="sidebar__nav-item">
            <NavLink to="/" className="sidebar__nav-link">
              <span className="sidebar__nav-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 13.5L3.5 8 9 2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12.5 8H4" strokeLinecap="round" />
                </svg>
              </span>
              Developer Portal
            </NavLink>
          </li>
          <li className="sidebar__nav-item">
            <button
              type="button"
              className="sidebar__nav-link"
              onClick={handleLogout}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                color: 'var(--color-danger, #cf222e)',
              }}
            >
              <span className="sidebar__nav-icon">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 14H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h3" strokeLinecap="round" />
                  <polyline points="11 11 14 8 11 5" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="14" y1="8" x2="6" y2="8" strokeLinecap="round" />
                </svg>
              </span>
              Sign Out
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
};

export default AdminSidebar;
