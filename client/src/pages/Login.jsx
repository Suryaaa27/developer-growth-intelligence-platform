import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Resolves post-login destination based on verified backend role and optional intended route.
 * Preserves redirect destination only if it is permitted for the user's role.
 */
const resolvePostLoginRedirect = (role, fromLocation) => {
  const defaultDestination = role === 'ADMIN' ? '/admin' : '/';

  if (!fromLocation) {
    return defaultDestination;
  }

  const targetPath =
    typeof fromLocation === 'string' ? fromLocation : fromLocation?.pathname;

  // Prevent redirect loops back to auth pages
  if (!targetPath || targetPath === '/login' || targetPath === '/register') {
    return defaultDestination;
  }

  // Prevent regular users from being redirected to the admin namespace
  if (targetPath.startsWith('/admin')) {
    return role === 'ADMIN' ? targetPath : '/';
  }

  return targetPath;
};

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submittedMessage, setSubmittedMessage] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading: authLoading, login: setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // If already authenticated and not actively submitting, redirect to role dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated && user && !submittedMessage) {
      const destination = user.role === 'ADMIN' ? '/admin' : '/';
      navigate(destination, { replace: true });
    }
  }, [authLoading, isAuthenticated, user, submittedMessage, navigate]);

  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email format.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError(null);
    try {
      const response = await authAPI.login({
        email: formData.email,
        password: formData.password,
      });
      if (response.success && response.data?.user) {
        const authenticatedUser = response.data.user;
        const jwtToken = response.data.token;

        // Store token and user in auth context immediately
        setAuth(authenticatedUser, jwtToken);
        setSubmittedMessage('Login successful! Redirecting...');

        // Determine destination based on verified user role & redirect location
        const destination = resolvePostLoginRedirect(
          authenticatedUser.role,
          location.state?.from
        );

        setTimeout(() => navigate(destination, { replace: true }), 400);
      } else {
        setApiError(response.message || 'Login failed');
      }
    } catch (err) {
      setApiError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 72px)', padding: 'var(--space-6)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '440px', padding: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 className="page-header__title" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>
              Sign In to DevGrowth
            </h1>
            <p className="page-header__subtitle" style={{ margin: 0 }}>
              Access your developer skill growth metrics and portfolio intelligence.
            </p>
          </div>

          {submittedMessage && (
            <div
              className="card card--compact mb-6"
              style={{
                backgroundColor: 'var(--color-accent-light)',
                border: '1px solid var(--color-accent-border)',
                color: 'var(--color-accent)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {submittedMessage}
            </div>
          )}
          {apiError && (
            <div className="card card--compact mb-6" style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
              {apiError}
            </div>
          )}
          {loading && (
            <div className="card card--compact mb-6" style={{ backgroundColor: 'var(--color-accent-light)', border: '1px solid var(--color-accent-border)', color: 'var(--color-accent-fg)', fontSize: 'var(--text-sm)' }}>
              Logging in... Please wait.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="developer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between" style={{ marginBottom: '2px' }}>
                <label htmlFor="login-password" className="form-label">
                  Password
                </label>
                <a href="#forgot" onClick={(e) => e.preventDefault()} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>
                  Forgot password?
                </a>
              </div>
              <div className="input-password-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn--primary w-full" style={{ width: '100%', marginTop: 'var(--space-3)' }}>
              Sign In
            </button>
          </form>

          <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

          <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Don't have an account yet?{' '}
            <Link to="/register" style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-accent)' }}>
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
