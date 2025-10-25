/**
 * Zustand store for note management
 * Based on requirements 6.1, 6.4
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Note } from '../types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface NoteDraft {
  title?: string;
  content?: string;
  updatedAt: number;
}

export interface NoteState {
  // State
  notes: Note[];
  selectedNoteId: string | null;
  isLoading: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  unsavedChanges: Record<string, NoteDraft>;

  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  selectNote: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setSaveError: (error: string | null) => void;
  setLastSavedAt: (timestamp: number | null) => void;
  recordUnsavedChanges: (id: string, draft: Partial<Omit<NoteDraft, 'updatedAt'>>) => void;
  clearUnsavedChanges: (id: string) => void;

  // Computed getters
  getSelectedNote: () => Note | null;
  getNoteById: (id: string) => Note | null;
  getNotesByParent: (parentId: string | null) => Note[];
  getRootNotes: () => Note[];
  getUnsavedChanges: (id: string) => NoteDraft | null;
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set, get) => ({
      // Initial state
      notes: [],
      selectedNoteId: null,
      isLoading: false,
      error: null,
      saveStatus: 'idle',
      saveError: null,
      lastSavedAt: null,
      unsavedChanges: {},
      
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

      setSaveStatus: (status) => set({ saveStatus: status }),

      setSaveError: (error) => set({ saveError: error }),

      setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),

      recordUnsavedChanges: (id, draft) => set((state) => ({
        unsavedChanges: {
          ...state.unsavedChanges,
          [id]: {
            ...state.unsavedChanges[id],
            ...draft,
            updatedAt: Date.now()
          }
        }
      })),

      clearUnsavedChanges: (id) => set((state) => {
        if (!state.unsavedChanges[id]) {
          return {} as Partial<NoteState>;
        }

        const updated = { ...state.unsavedChanges };
        delete updated[id];
        return { unsavedChanges: updated };
      }),

      // Computed getters
      getSelectedNote: () => {
        const state = get();
        return state.notes.find(note => note.id === state.selectedNoteId) || null;
      },

      getNoteById: (id) => {
        const state = get();
        return state.notes.find(note => note.id === id) || null;
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
      },

      getUnsavedChanges: (id) => {
        const state = get();
        return state.unsavedChanges[id] || null;
      }
    }),
    {
      name: 'note-store',
      // Only persist notes and selectedNoteId, not loading/error states
      partialize: (state) => ({
        notes: state.notes,
        selectedNoteId: state.selectedNoteId,
        unsavedChanges: state.unsavedChanges,
        lastSavedAt: state.lastSavedAt,
        saveStatus: state.saveStatus,
        saveError: state.saveError
      })
    }
  )
);