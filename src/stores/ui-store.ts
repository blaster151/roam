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

  // Sidebar tree state
  collapsedNoteIds: Record<string, boolean>;

  // Actions
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setFirstTimeUser: (isFirstTime: boolean) => void;
  setShowWelcomeScreen: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchVisible: (visible: boolean) => void;
  setEditorFocused: (focused: boolean) => void;
  setNoteCollapsed: (noteId: string, collapsed: boolean) => void;
  toggleNoteCollapsed: (noteId: string) => void;
  isNoteCollapsed: (noteId: string) => boolean;

  // Welcome screen actions
  dismissWelcomeScreen: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      sidebarCollapsed: false,
      sidebarWidth: 280,
      isFirstTimeUser: true,
      showWelcomeScreen: true,
      searchQuery: '',
      searchVisible: false,
      editorFocused: false,
      collapsedNoteIds: {},

      // Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setSidebarWidth: (width) => set({ sidebarWidth: Math.max(200, Math.min(500, width)) }),
      
      setFirstTimeUser: (isFirstTime) => set({ isFirstTimeUser: isFirstTime }),
      
      setShowWelcomeScreen: (show) => set({ showWelcomeScreen: show }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),

      setSearchVisible: (visible) => set({ searchVisible: visible }),

      setEditorFocused: (focused) => set({ editorFocused: focused }),

      setNoteCollapsed: (noteId, collapsed) =>
        set((state) => {
          const collapsedNoteIds = { ...state.collapsedNoteIds };
          if (collapsed) {
            collapsedNoteIds[noteId] = true;
          } else {
            delete collapsedNoteIds[noteId];
          }

          return { collapsedNoteIds };
        }),

      toggleNoteCollapsed: (noteId) =>
        set((state) => {
          const collapsed = Boolean(state.collapsedNoteIds[noteId]);
          const collapsedNoteIds = { ...state.collapsedNoteIds };

          if (collapsed) {
            delete collapsedNoteIds[noteId];
          } else {
            collapsedNoteIds[noteId] = true;
          }

          return { collapsedNoteIds };
        }),

      isNoteCollapsed: (noteId) => Boolean(get().collapsedNoteIds[noteId]),

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
        showWelcomeScreen: state.showWelcomeScreen,
        collapsedNoteIds: state.collapsedNoteIds
      })
    }
  )
);