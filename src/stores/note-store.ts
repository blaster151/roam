/**
 * Zustand store for note management
 * Based on requirements 6.1, 6.4
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note } from '../types';

export interface NoteState {
  // State
  notes: Note[];
  selectedNoteId: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed getters
  getSelectedNote: () => Note | null;
  getNotesByParent: (parentId: string | null) => Note[];
  getRootNotes: () => Note[];
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set, get) => ({
      // Initial state
      notes: [],
      selectedNoteId: null,
      isLoading: false,
      error: null,
      
      // Actions
      setNotes: (notes) => set({ notes }),
      
      addNote: (note) => set((state) => ({
        notes: [...state.notes, note]
      })),
      
      updateNote: (id, updates) => set((state) => ({
        notes: state.notes.map(note => 
          note.id === id 
            ? { ...note, ...updates, updatedAt: new Date() }
            : note
        )
      })),
      
      deleteNote: (id) => set((state) => {
        // Also remove from selection if it's the selected note
        const newState: Partial<NoteState> = {
          notes: state.notes.filter(note => note.id !== id)
        };
        
        if (state.selectedNoteId === id) {
          newState.selectedNoteId = null;
        }
        
        return newState;
      }),
      
      selectNote: (id) => set({ selectedNoteId: id }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      // Computed getters
      getSelectedNote: () => {
        const state = get();
        return state.notes.find(note => note.id === state.selectedNoteId) || null;
      },
      
      getNotesByParent: (parentId) => {
        const state = get();
        return state.notes
          .filter(note => note.parentId === parentId)
          .sort((a, b) => a.order - b.order);
      },
      
      getRootNotes: () => {
        const state = get();
        return state.notes
          .filter(note => !note.parentId)
          .sort((a, b) => a.order - b.order);
      }
    }),
    {
      name: 'note-store',
      // Only persist notes and selectedNoteId, not loading/error states
      partialize: (state) => ({
        notes: state.notes,
        selectedNoteId: state.selectedNoteId
      })
    }
  )
);