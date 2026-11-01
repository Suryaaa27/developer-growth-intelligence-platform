import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AuthScene from '../components/auth/AuthScene';
import { authAPI, rolesAPI } from '../services/api';

const CATEGORY_ORDER = [
  'Software Development',
  'Mobile Development',
  'Data Engineering & AI',
  'DevOps & Cloud',
  'Cybersecurity',
  'QA & Testing',
  'Embedded & Systems',
  'Architecture & Specialized Engineering',
];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    targetRole: 'Java Backend Developer',
    password: '',
    confirmPassword: '',
  });
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submittedMessage, setSubmittedMessage] = useState(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Fetch available role catalog dynamically from database
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setRolesLoading(true);
        setRolesError(null);
        const res = await rolesAPI.getAllRoles();
        if (isMounted && res?.success && Array.isArray(res?.data?.roles) && res.data.roles.length > 0) {
          setRoles(res.data.roles);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[Register] Failed to load role catalog from API:', err.message);
          setRolesError('Could not load live role catalog. Fallback defaults active.');
        }
      } finally {
        if (isMounted) {
          setRolesLoading(false);
        }
      }
    };
    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // Group roles into standardized categories
  const groupedRoles = useMemo(() => {
    const sourceRoles = roles.length > 0 ? roles : [
      { id: 1, roleName: 'Java Backend Developer', category: 'Software Development' },
      { id: 2, roleName: 'Full Stack JavaScript Developer', category: 'Software Development' },
      { id: 3, roleName: 'DevOps & Cloud Engineer', category: 'DevOps & Cloud' },
    ];

    const groups = {};
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = [];
    }
    groups['Other Engineering Roles'] = [];

    for (const r of sourceRoles) {
      const cat = r.category && groups[r.category] ? r.category : 'Other Engineering Roles';
      groups[cat].push(r);
    }

    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [roles]);

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

    if (!formData.targetRole || !formData.targetRole.trim()) {
      newErrors.targetRole = 'Please select a target engineering role.';
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
    <div className="auth-page">
      <AuthScene
        headline="Start your growth journey."
        subline="Connect GitHub and see which skills your code already shows."
      />
      <Navbar />
      <main className="auth-center">
        <div className="auth-header-block">
          <h1 className="auth-headline">Start your growth journey.</h1>
          <p className="auth-subline">Connect GitHub and see which skills your code already shows.</p>
        </div>

        <div className="auth-card auth-card--wide">
          <div className="auth-card__head">
            <h2 className="auth-card__title">Create your DevGrowth account</h2>
            <p className="auth-card__subtitle">
              Benchmark your GitHub code evidence against targeted developer roles.
            </p>
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
              <div className="auth-role-label-row">
                <label htmlFor="reg-role" className="form-label" style={{ margin: 0 }}>
                  Target Engineering Role <span className="auth-required">*</span>
                </label>
                {rolesLoading && (
                  <span className="auth-loading-hint">
                    Loading catalog...
                  </span>
                )}
              </div>

              <select
                id="reg-role"
                className="form-select"
                value={formData.targetRole}
                onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                disabled={rolesLoading && roles.length === 0}
              >
                {groupedRoles.map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((r) => (
                      <option key={r.id} value={r.roleName}>
                        {r.roleName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errors.targetRole && <span className="form-error">{errors.targetRole}</span>}
              {rolesError && (
                <span className="auth-role-warning">
                  {rolesError}
                </span>
              )}
            </div>

            <div className="auth-row">
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
            </div>

            <button
              type="submit"
              className="btn btn--primary w-full auth-submit"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-card__divider" />

          <p className="auth-card__footer">
            Already have an account?{' '}
            <Link to="/login" className="auth-link auth-link--strong">
              Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Register;
