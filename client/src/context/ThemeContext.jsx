import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'devgrowth_theme';

export const ThemeProvider = ({ children }) => {
  // Theme preference can be 'system' | 'light' | 'dark'
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  // Calculate if system preference is currently dark
  const getSystemTheme = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    const saved = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) || 'system';
      } catch {
        return 'system';
      }
    })();
    if (saved === 'system') {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }
    return saved;
  });

  // Apply theme to document element
  const applyTheme = useCallback((effectiveTheme, preference) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', effectiveTheme);
    root.setAttribute('data-theme-preference', preference);
    root.style.colorScheme = effectiveTheme;
  }, []);

  // Update theme setting
  const setTheme = useCallback(
    (newTheme) => {
      if (!['system', 'light', 'dark'].includes(newTheme)) return;
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_KEY, newTheme);
      } catch (err) {
        console.warn('[ThemeContext] Unable to persist theme:', err);
      }

      const effective = newTheme === 'system' ? getSystemTheme() : newTheme;
      setResolvedTheme(effective);
      applyTheme(effective, newTheme);
    },
    [getSystemTheme, applyTheme]
  );

  // Synchronize on mount and handle system media query changes
  useEffect(() => {
    const effective = theme === 'system' ? getSystemTheme() : theme;
    setResolvedTheme(effective);
    applyTheme(effective, theme);

    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e) => {
      if (theme === 'system') {
        const nextEffective = e.matches ? 'dark' : 'light';
        setResolvedTheme(nextEffective);
        applyTheme(nextEffective, 'system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme, getSystemTheme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
