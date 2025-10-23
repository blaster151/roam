/**
 * Zustand store for search functionality
 * Based on requirements 5.1, 5.4, 5.5
 */

import { create } from 'zustand';
import type { SearchResult } from '../types';

export interface SearchState {
  // State
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  isVisible: boolean;
  selectedResultIndex: number;
  
  // Actions
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setSearching: (searching: boolean) => void;
  setVisible: (visible: boolean) => void;
  setSelectedResultIndex: (index: number) => void;
  
  // Search navigation
  selectNextResult: () => void;
  selectPreviousResult: () => void;
  getSelectedResult: () => SearchResult | null;
  
  // Clear search
  clearSearch: () => void;
  
  // Show/hide search
  showSearch: () => void;
  hideSearch: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
  query: '',
  results: [],
  isSearching: false,
  isVisible: false,
  selectedResultIndex: -1,
  
  // Actions
  setQuery: (query) => set({ 
    query,
    selectedResultIndex: query ? 0 : -1 // Auto-select first result when searching
  }),
  
  setResults: (results) => set({ 
    results,
    selectedResultIndex: results.length > 0 ? 0 : -1 // Auto-select first result
  }),
  
  setSearching: (searching) => set({ isSearching: searching }),
  
  setVisible: (visible) => set({ isVisible: visible }),
  
  setSelectedResultIndex: (index) => {
    const state = get();
    const clampedIndex = Math.max(-1, Math.min(state.results.length - 1, index));
    set({ selectedResultIndex: clampedIndex });
  },
  
  // Search navigation
  selectNextResult: () => {
    const state = get();
    if (state.results.length === 0) return;
    
    const nextIndex = state.selectedResultIndex < state.results.length - 1 
      ? state.selectedResultIndex + 1 
      : 0; // Wrap to first result
    
    set({ selectedResultIndex: nextIndex });
  },
  
  selectPreviousResult: () => {
    const state = get();
    if (state.results.length === 0) return;
    
    const prevIndex = state.selectedResultIndex > 0 
      ? state.selectedResultIndex - 1 
      : state.results.length - 1; // Wrap to last result
    
    set({ selectedResultIndex: prevIndex });
  },
  
  getSelectedResult: () => {
    const state = get();
    return state.selectedResultIndex >= 0 && state.selectedResultIndex < state.results.length
      ? state.results[state.selectedResultIndex]
      : null;
  },
  
  // Clear search
  clearSearch: () => set({
    query: '',
    results: [],
    selectedResultIndex: -1,
    isSearching: false
  }),
  
  // Show/hide search
  showSearch: () => set({ isVisible: true }),
  
  hideSearch: () => set({ 
    isVisible: false,
    query: '',
    results: [],
    selectedResultIndex: -1,
    isSearching: false
  })
}));