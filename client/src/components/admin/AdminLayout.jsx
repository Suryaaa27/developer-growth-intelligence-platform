import { useRef } from 'react';
import Navbar from '../Navbar';
import AdminSidebar from './AdminSidebar';
import { useSidebar } from '../../context/SidebarContext';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import '../../styles/admin.css';

/**
 * AdminLayout — Isolated layout container for the Admin Portal
 * Provides dedicated AdminSidebar and preserves Navbar state and branding.
 */
const AdminLayout = ({ children }) => {
  const mainRef = useRef(null);
  const { isMobileOpen, closeMobileSidebar } = useSidebar();
  useScrollReveal(mainRef);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <AdminSidebar />
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

export default AdminLayout;
