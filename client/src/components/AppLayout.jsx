import { useRef } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useSidebar } from '../context/SidebarContext';
import { useScrollReveal } from '../hooks/useScrollReveal';

/**
 * AppLayout — Consistent layout container for standard app pages
 */
const AppLayout = ({ children }) => {
  const mainRef = useRef(null);
  const { isMobileOpen, closeMobileSidebar } = useSidebar();
  useScrollReveal(mainRef);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <div
          className={`sidebar-backdrop ${isMobileOpen ? 'active' : ''}`}
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
        <main className="main-content" id="main" ref={mainRef}>
          <div className="page-container">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
