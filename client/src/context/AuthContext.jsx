import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => sessionStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('token');
  }, []);

  const login = useCallback((userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setLoading(false);
    if (jwtToken) {
      sessionStorage.setItem('token', jwtToken);
    }
  }, []);

  // Restore session from sessionStorage and validate with GET /api/auth/me on mount/refresh
  useEffect(() => {
    let isCancelled = false;

    const restoreAndValidateSession = async () => {
      const storedToken = sessionStorage.getItem('token');
      if (!storedToken) {
        if (!isCancelled) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authAPI.getMe();
        if (!isCancelled) {
          if (response?.success && response?.data?.user) {
            setUser(response.data.user);
            setToken(storedToken);
          } else {
            logout();
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
              window.location.href = '/login';
            }
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.warn('[AuthContext] Session validation failed:', err.message);
          logout();
          if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
            window.location.href = '/login';
          }
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    restoreAndValidateSession();

    const handleExpired = () => {
      logout();
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    };

    window.addEventListener('auth:expired', handleExpired);
    return () => {
      isCancelled = true;
      window.removeEventListener('auth:expired', handleExpired);
    };
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !loading && !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for consuming auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
};

export default AuthContext;
