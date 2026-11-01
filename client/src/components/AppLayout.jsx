import { useRef } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useScrollReveal } from '../hooks/useScrollReveal';

/**
 * AppLayout — Consistent layout container for standard app pages
 */
const AppLayout = ({ children }) => {
  const mainRef = useRef(null);
  useScrollReveal(mainRef);

  return (
    <div className="app-shell">
      <Navbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" id="main" ref={mainRef}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
