import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    targetRole: 'Java Backend Developer',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submittedMessage, setSubmittedMessage] = useState(null);
  const navigate = useNavigate();
  const { login: setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please provide a valid email format.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
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
      const response = await authAPI.register({
        name: formData.name,
        email: formData.email,
        targetRole: formData.targetRole,
        password: formData.password,
      });
      if (response.success) {
        setSubmittedMessage('Registration successful! You can now log in.');
        // Clear form fields
        setFormData({ name: '', email: '', targetRole: 'Java Backend Developer', password: '', confirmPassword: '' });
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setApiError(response.message || 'Registration failed');
      }
    } catch (err) {
      setApiError(err.message || 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 72px)', padding: 'var(--space-6)' }}>
        <div className="card" style={{ width: '100%', maxWidth: '480px', padding: 'var(--space-8)' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
            <h1 className="page-header__title" style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>
              Create Your Account
            </h1>
            <p className="page-header__subtitle" style={{ margin: 0 }}>
              Benchmark your GitHub code evidence against targeted developer roles.
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
              Registering... Please wait.
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="reg-name" className="form-label">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                placeholder="Jane Developer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="reg-email" className="form-label">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="developer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="reg-role" className="form-label">
                Target Engineering Role
              </label>
              <select
                id="reg-role"
                className="form-select"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
              >
                <option value="Java Backend Developer">Java Backend Developer</option>
                <option value="Full Stack JavaScript Developer">Full Stack JavaScript Developer</option>
                <option value="DevOps & Cloud Engineer">DevOps & Cloud Engineer</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password" className="form-label">
                Password (min. 8 characters)
              </label>
              <div className="input-password-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Create a secure password"
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

            <div className="form-group">
              <label htmlFor="reg-confirm-password" className="form-label">
                Confirm Password
              </label>
              <div className="input-password-wrapper">
                <input
                  id="reg-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
            </div>

            <button type="submit" className="btn btn--primary w-full" style={{ width: '100%', marginTop: 'var(--space-3)' }}>
              Create Account
            </button>
          </form>

          <div className="divider" style={{ margin: 'var(--space-6) 0' }} />

          <p style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ fontWeight: 'var(--fw-semibold)', color: 'var(--color-accent)' }}>
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Register;
