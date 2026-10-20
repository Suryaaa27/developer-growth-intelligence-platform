import Navbar from './Navbar';
import Sidebar from './Sidebar';

/**
 * AppLayout — Consistent layout container for standard app pages
 */
const AppLayout = ({ children }) => {
  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
