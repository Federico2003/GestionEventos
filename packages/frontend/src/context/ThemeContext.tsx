import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '../types';

const STORAGE_KEY = 'planora-color-scheme';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => undefined
});

function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', mode);
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', mode);
  }
}

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage block
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'dark' || e.newValue === 'light')) {
        setTheme(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage block
      }
      applyThemeToDocument(next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export const ThemeToggleButton: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
      }
      className="flex items-center gap-2 px-3.5 py-2 rounded-xl btn-trunk text-xs font-semibold shadow-sm cursor-pointer"
    >
      {theme === 'dark' ? (
        <>
          <svg
            aria-hidden="true"
            className="w-4 h-4 text-[#F6F3EE]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
          </svg>
          <span>Modo Claro</span>
        </>
      ) : (
        <>
          <svg
            aria-hidden="true"
            className="w-4 h-4 text-[#F6F3EE]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <span>Modo Oscuro</span>
        </>
      )}
    </button>
  );
};
