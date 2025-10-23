/**
 * Zustand store for UI state management
 * Based on requirements 6.4, 7.1, 7.5
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UIState {
  // Sidebar state
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  
  // Welcome screen state
  isFirstTimeUser: boolean;
  showWelcomeScreen: boolean;
  
  // Search state
  searchQuery: string;
  searchVisible: boolean;
  
  // Editor state
  editorFocused: boolean;
  
  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setFirstTimeUser: (isFirstTime: boolean) => void;
  setShowWelcomeScreen: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchVisible: (visible: boolean) => void;
  setEditorFocused: (focused: boolean) => void;
  
  // Welcome screen actions
  dismissWelcomeScreen: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarCollapsed: false,
      sidebarWidth: 280,
      isFirstTimeUser: true,
      showWelcomeScreen: true,
      searchQuery: '',
      searchVisible: false,
      editorFocused: false,
      
      // Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),
      
      setFirstTimeUser: (isFirstTime) => set({ isFirstTimeUser: isFirstTime }),
      
      setShowWelcomeScreen: (show) => set({ showWelcomeScreen: show }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setSearchVisible: (visible) => set({ searchVisible: visible }),
      
      setEditorFocused: (focused) => set({ editorFocused: focused }),
      
      dismissWelcomeScreen: () => set({ 
        showWelcomeScreen: false, 
        isFirstTimeUser: false 
      })
    }),
    {
      name: 'ui-store',
      // Persist UI preferences but not transient states like search query
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        isFirstTimeUser: state.isFirstTimeUser,
        showWelcomeScreen: state.showWelcomeScreen
      })
    }
  )
);