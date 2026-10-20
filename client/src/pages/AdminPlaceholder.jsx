import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

/**
 * AdminPlaceholder Page
 * Represents the planned route namespace for the Admin Portal (/admin/*).
 * Confirms that the current user has verified ADMIN credentials while adhering
 * to the requirement: "Plan separate route namespaces for the developer portal
 * and admin portal, but do not build the admin UI yet."
 */
const AdminPlaceholder = () => {
  const { user } = useAuth();

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main
        className="main-content"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-8, 32px)',
        }}
      >
        <div
          style={{
            maxWidth: '680px',
            width: '100%',
            background: 'var(--surface-primary, #1e293b)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
            borderRadius: '16px',
            padding: '36px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            textAlign: 'center',
          }}
        >
          {/* Shield Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--color-primary, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
              }}
            >
              ADMIN Namespace Planned
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              Authenticated as {user?.role || 'ADMIN'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-primary, #f8fafc)' }}>
            Admin Portal Route Namespace
          </h1>

          <p style={{ color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.6, marginBottom: '24px', fontSize: '0.95rem' }}>
            This route namespace (<code>/admin/*</code>) is dedicated to platform administration and user management.
            Backend RBAC middleware (<code>requireAdmin</code>) and frontend route guards are active and verified.
            The complete administrative management dashboard UI is slated for implementation in an upcoming milestone.
          </p>

          <div
            style={{
              background: 'var(--surface-secondary, rgba(0,0,0,0.2))',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '28px',
              fontSize: '0.85rem',
              color: 'var(--text-secondary, #94a3b8)',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary, #f8fafc)', marginBottom: '6px' }}>
              Namespace Security Boundary Summary:
            </div>
            <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.7 }}>
              <li><strong>Frontend Route:</strong> <code>/admin/*</code> protected by <code>&lt;ProtectedRoute allowedRoles={['ADMIN']}&gt;</code></li>
              <li><strong>Backend API:</strong> <code>/api/admin/*</code> secured by <code>authenticate</code> + <code>requireAdmin</code></li>
              <li><strong>Active Account:</strong> {user?.name} ({user?.email})</li>
            </ul>
          </div>

          <Link
            to="/"
            className="btn btn--primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
          >
            ← Return to Developer Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
};

export default AdminPlaceholder;
