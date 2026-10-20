import { NavLink } from 'react-router-dom';

/**
 * Sidebar — primary navigation panel using React Router NavLink
 */

const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Analysis',
    items: [
      {
        label: 'Repositories',
        href: '/repositories',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
            <path d="M4 6h3M4 9h5M4 12h2" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: 'Skill Analysis',
        href: '/skills',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 5v3l2 2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Skill Gaps',
        href: '/gaps',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 2v12M2 8h12" strokeLinecap="round" />
            <circle cx="8" cy="8" r="6" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Growth',
    items: [
      {
        label: 'Learning Roadmap',
        href: '/roadmap',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 13 6 3l4 6 2-3 2 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        label: 'Progress History',
        href: '/progress',
        icon: (
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="9" width="3" height="6" rx="0.5" />
            <rect x="6" y="5" width="3" height="10" rx="0.5" />
            <rect x="11" y="2" width="3" height="13" rx="0.5" />
          </svg>
        ),
      },
    ],
  },
];

const Sidebar = () => {
  return (
    <aside className="sidebar">
      {NAV_ITEMS.map((group) => (
        <div key={group.section}>
          <p className="sidebar__section-label">{group.section}</p>
          <ul className="sidebar__nav">
            {group.items.map((item) => (
              <li key={item.label} className="sidebar__nav-item">
                <NavLink
                  to={item.href}
                  end={item.href === '/'}
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
          <div className="sidebar__divider" />
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;
