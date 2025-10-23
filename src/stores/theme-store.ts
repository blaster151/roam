/**
 * Zustand store for theme management
 * Based on requirements 8.4, 8.5
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeState {
  // State
  theme: Theme;
  systemTheme: 'light' | 'dark';
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSystemTheme: (theme: 'light' | 'dark') => void;
  
  // Computed getters
  getEffectiveTheme: () => 'light' | 'dark';
}

// Detect system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Apply theme to document
const applyTheme = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  
  document.documentElement.setAttribute('data-theme', theme);
  
  // Also set a class for CSS compatibility
  document.documentElement.classList.remove('light-theme', 'dark-theme');
  document.documentElement.classList.add(`${theme}-theme`);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'system',
      systemTheme: getSystemTheme(),
      
      // Actions
      setTheme: (theme) => {
        set({ theme });
        const effectiveTheme = theme === 'system' ? get().systemTheme : theme;
        applyTheme(effectiveTheme);
      },
      
      toggleTheme: () => {
        const currentTheme = get().getEffectiveTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },
      
      setSystemTheme: (systemTheme) => {
        set({ systemTheme });
        // If using system theme, update the applied theme
        const state = get();
        if (state.theme === 'system') {
          applyTheme(systemTheme);
        }
      },
      
      // Computed getters
      getEffectiveTheme: () => {
        const state = get();
        return state.theme === 'system' ? state.systemTheme : state.theme;
      }
    }),
    {
      name: 'theme-store',
      // Only persist user's theme preference, not system theme
      partialize: (state) => ({
        theme: state.theme
      }),
      // Apply theme on hydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          const effectiveTheme = state.getEffectiveTheme();
          applyTheme(effectiveTheme);
        }
      }
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleSystemThemeChange = (e: MediaQueryListEvent) => {
    const systemTheme = e.matches ? 'dark' : 'light';
    useThemeStore.getState().setSystemTheme(systemTheme);
  };
  
  mediaQuery.addEventListener('change', handleSystemThemeChange);
}