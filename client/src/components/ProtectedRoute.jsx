import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * Guards frontend routes by verifying authenticated state and optional role permissions.
 * Note: Frontend route guards enhance UX and navigation flow; the backend authorization
 * middleware (authenticate, authorizeRoles, requireSelfOrAdmin) remains the authoritative
 * security boundary.
 *
 * @param {React.ReactNode} children - Component(s) to render if authorized
 * @param {string[]} [allowedRoles] - Optional list of permitted roles (e.g. ['ADMIN'])
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            border: '3px solid var(--border-subtle, rgba(255,255,255,0.1))',
            borderTopColor: 'var(--color-primary, #6366f1)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem' }}>
          Verifying security credentials...
        </p>
      </div>
    );
  }

  // If user is unauthenticated, redirect to /login and preserve destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If route requires specific roles (e.g. ADMIN portal namespace)
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role || 'USER';
    if (!allowedRoles.includes(userRole)) {
      // Authenticated user lacks the required role; redirect to developer dashboard
      return <Navigate to="/" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
