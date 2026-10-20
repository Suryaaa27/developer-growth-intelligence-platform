import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * ThemeSelector — Accessible Light / Dark / System theme switcher
 * Styled with GitHub-inspired minimalism.
 */
const ThemeSelector = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const options = [
    {
      id: 'light',
      label: 'Light',
      description: 'White surfaces & green accents',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0ZM8 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13ZM3.05 3.05a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06L3.05 4.11a.75.75 0 0 1 0-1.06ZM10.83 10.83a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06ZM0 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H.75A.75.75 0 0 1 0 8ZM13 8a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5A.75.75 0 0 1 13 8ZM3.05 12.95a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0ZM10.83 5.17a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0Z" />
        </svg>
      ),
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Charcoal & dark-gray surfaces',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Zm1.616 1.945a7 7 0 0 1-7.678 7.678A5.499 5.499 0 1 0 11.214 3.536Z" />
        </svg>
      ),
    },
    {
      id: 'system',
      label: 'System',
      description: `Follows device setting (${resolvedTheme})`,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.75 1.5h12.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 14.25 12.5H9.5v1.75h2a.75.75 0 0 1 0 1.5H4.5a.75.75 0 0 1 0-1.5h2V12.5H1.75A1.75 1.75 0 0 1 0 10.75v-7.5C0 2.284.784 1.5 1.75 1.5ZM1.5 3.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z" />
        </svg>
      ),
    },
  ];

  const currentOption = options.find((opt) => opt.id === theme) || options[2];

  return (
    <div className="theme-selector-container" ref={containerRef}>
      <button
        type="button"
        className="theme-selector-btn"
        id="theme-selector-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Select color theme. Currently ${theme} (resolved: ${resolvedTheme})`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Theme: ${currentOption.label}`}
      >
        <span className="theme-selector-icon">{currentOption.icon}</span>
        <span className="theme-selector-label">{currentOption.label}</span>
        <svg
          className={`theme-selector-arrow ${isOpen ? 'rotated' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {isOpen && (
        <div className="theme-dropdown" role="menu" id="theme-dropdown-menu">
          <div className="theme-dropdown-title">Appearance</div>
          {options.map((opt) => {
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`theme-dropdown-option ${isSelected ? 'active' : ''}`}
                id={`theme-option-${opt.id}`}
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                }}
              >
                <span className="theme-option-icon">{opt.icon}</span>
                <div className="theme-option-text">
                  <span className="theme-option-name">{opt.label}</span>
                  <span className="theme-option-desc">{opt.description}</span>
                </div>
                {isSelected && (
                  <svg className="theme-check-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ThemeSelector;
