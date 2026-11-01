import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Logo from '../components/Logo';
import AuthScene from '../components/auth/AuthScene';
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
    <div className="auth-page">
      <AuthScene
        headline="Grow from what you have built."
        subline="We turn your repositories into a skill roadmap."
      />
      <Navbar showSidebarToggle={false} />
      <main className="auth-center">
        <div className="auth-header-block">
          <h1 className="auth-headline">Grow from what you have built.</h1>
          <p className="auth-subline">We turn your repositories into a skill roadmap.</p>
        </div>

        <div className="auth-card">
          <div className="auth-card__head">
            <Logo variant="mark" size={48} animated className="auth-logo" />
            <h2 className="auth-card__title">Sign in to DevGrowth</h2>
            <p className="auth-card__subtitle">Enter your credentials to access your account</p>
          </div>

          {submittedMessage && (
            <div className="auth-flash auth-flash--success">
              {submittedMessage}
            </div>
          )}
          {apiError && (
            <div className="auth-flash auth-flash--error">
              {apiError}
            </div>
          )}
          {loading && (
            <div className="auth-flash auth-flash--info">
              Logging in... Please wait.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">
                Email address
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
              <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                <label htmlFor="login-password" className="form-label" style={{ marginBottom: 0 }}>
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => e.preventDefault()}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--color-link)' }}
                >
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

            <button
              type="submit"
              className="btn btn--primary w-full auth-submit"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-card__divider" />

          <p className="auth-card__footer">
            New to DevGrowth?{' '}
            <Link to="/register" className="auth-link auth-link--strong">
              Create an account
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;
