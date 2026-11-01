import { NavLink } from 'react-router-dom';
import { useSidebar } from '../context/SidebarContext';
import {
  GraphIcon,
  PersonIcon,
  RepoIcon,
  PulseIcon,
  AlertIcon,
  MilestoneIcon,
  MeterIcon,
} from './icons';

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
        icon: <GraphIcon size={16} />,
      },
      {
        label: 'Profile',
        href: '/profile',
        icon: <PersonIcon size={16} />,
      },
    ],
  },
  {
    section: 'Analysis',
    items: [
      {
        label: 'Repositories',
        href: '/repositories',
        icon: <RepoIcon size={16} />,
      },
      {
        label: 'Skill Analysis',
        href: '/skills',
        icon: <PulseIcon size={16} />,
      },
      {
        label: 'Skill Gaps',
        href: '/gaps',
        icon: <AlertIcon size={16} />,
      },
    ],
  },
  {
    section: 'Growth',
    items: [
      {
        label: 'Learning Roadmap',
        href: '/roadmap',
        icon: <MilestoneIcon size={16} />,
      },
      {
        label: 'Progress History',
        href: '/progress',
        icon: <MeterIcon size={16} />,
      },
    ],
  },
];

const Sidebar = () => {
  const { isCollapsed, isMobileOpen, closeMobileSidebar } = useSidebar();

  return (
    <aside
      id="app-sidebar"
      className={`sidebar app-sidebar ${isCollapsed ? 'collapsed' : ''} ${
        isMobileOpen ? 'mobile-open' : ''
      }`}
    >
      {NAV_ITEMS.map((group) => (
        <div key={group.section}>
          <p className="sidebar__section-label">{group.section}</p>
          <ul className="sidebar__nav">
            {group.items.map((item, itemIdx) => (
              <li key={item.label} className="sidebar__nav-item" style={{ '--item-i': itemIdx }}>
                <NavLink
                  to={item.href}
                  end={item.href === '/'}
                  onClick={closeMobileSidebar}
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
