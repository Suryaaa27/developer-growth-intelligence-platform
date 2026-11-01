import { useRef } from 'react';
import Navbar from '../Navbar';
import AdminSidebar from './AdminSidebar';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import '../../styles/admin.css';

/**
 * AdminLayout — Isolated layout container for the Admin Portal
 * Provides dedicated AdminSidebar and preserves Navbar state and branding.
 */
const AdminLayout = ({ children }) => {
  const mainRef = useRef(null);
  useScrollReveal(mainRef);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <AdminSidebar />
        <main className="main-content" id="main" ref={mainRef}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
