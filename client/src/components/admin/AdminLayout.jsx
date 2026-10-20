import Navbar from '../Navbar';
import AdminSidebar from './AdminSidebar';
import '../../styles/admin.css';

/**
 * AdminLayout — Isolated layout container for the Admin Portal
 * Provides dedicated AdminSidebar and preserves Navbar state and branding.
 */
const AdminLayout = ({ children }) => {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <AdminSidebar />
        <main className="main-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
