/**
 * Main App component with layout, keyboard shortcuts, and welcome screen
 * Based on requirements 1.4, 1.5, 1.6
 */

import { useEffect, useCallback } from 'react';
import { useUIStore, useThemeStore, useNoteStore } from './stores';
import { WelcomeScreen, RichTextEditor } from './components';
import './App.css';

function App() {
  const { showWelcomeScreen } = useUIStore();
  const { getEffectiveTheme } = useThemeStore();
  const { getSelectedNote, addNote, selectNote, notes } = useNoteStore();

  // Global keyboard shortcuts handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts when not in input fields
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.contentEditable === 'true';

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          if (!isInputField) {
            event.preventDefault();
            // Bold formatting - will be handled by editor component
            console.log('Bold shortcut triggered');
          }
          break;
        
        case 'i':
          if (!isInputField) {
            event.preventDefault();
            // Italic formatting - will be handled by editor component
            console.log('Italic shortcut triggered');
          }
          break;
        
        case 'k':
          if (!isInputField) {
            event.preventDefault();
            // Link creation - will be handled by editor component
            console.log('Link shortcut triggered');
          }
          break;
        
        case 'n':
          event.preventDefault();
          // Create new note
          console.log('New note shortcut triggered');
          break;
        
        case 'f':
          event.preventDefault();
          // Focus search
          console.log('Search shortcut triggered');
          break;
      }
    }
    
    // Escape key handling
    if (event.key === 'Escape') {
      // Close search, modals, etc.
      console.log('Escape key pressed');
    }
  }, []);

  // Set up global keyboard shortcuts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Apply theme on mount and theme changes
  useEffect(() => {
    const theme = getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('light-theme', 'dark-theme');
    document.documentElement.classList.add(`${theme}-theme`);
  }, [getEffectiveTheme]);

  // Create a new note
  const createNewNote = useCallback(() => {
    const newNote = {
      id: `note_${Date.now()}`,
      title: 'Untitled Note',
      content: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      order: notes.length,
      links: {
        outbound: [],
        inbound: []
      },
      embeds: []
    };
    
    addNote(newNote);
    selectNote(newNote.id);
  }, [addNote, selectNote, notes.length]);

  // Show welcome screen for first-time users
  if (showWelcomeScreen) {
    return <WelcomeScreen />;
  }

  return (
    <div className="app">
      <div className="app-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <h1 className="app-title">Web Notes</h1>
            <button className="theme-toggle" title="Toggle theme">
              🌙
            </button>
          </div>
          
          <div className="sidebar-content">
            <div className="sidebar-actions">
              <button className="new-note-btn" onClick={createNewNote}>
                + New Note
              </button>
            </div>
            
            <div className="notes-list">
              {notes.length === 0 ? (
                <div className="notes-placeholder">
                  <p>No notes yet</p>
                  <p className="notes-placeholder-hint">
                    Create your first note to get started
                  </p>
                </div>
              ) : (
                <div className="notes-items">
                  {notes.map(note => (
                    <div 
                      key={note.id}
                      className={`note-item ${getSelectedNote()?.id === note.id ? 'selected' : ''}`}
                      onClick={() => selectNote(note.id)}
                    >
                      <div className="note-item-title">{note.title}</div>
                      <div className="note-item-date">
                        {note.updatedAt.toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="main-content">
          <div className="editor-container">
            {getSelectedNote() ? (
              <div className="editor-wrapper">
                <div className="note-header">
                  <input 
                    type="text" 
                    className="note-title-input"
                    placeholder="Note title..."
                    defaultValue={getSelectedNote()?.title}
                  />
                </div>
                <RichTextEditor
                  initialContent={getSelectedNote()?.content}
                  placeholder="Start writing your note..."
                  autoFocus={true}
                  supportMarkdown={true}
                  supportImages={true}
                />
              </div>
            ) : (
              <div className="no-note-selected">
                <div className="no-note-content">
                  <h2>Welcome to Web Notes</h2>
                  <p>Select a note from the sidebar or create a new one to start writing.</p>
                  <button className="create-first-note-btn" onClick={createNewNote}>
                    Create Your First Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Search overlay - will be implemented later */}
      <div className="search-overlay" style={{ display: 'none' }}>
        <div className="search-container">
          <input 
            type="text" 
            placeholder="Search notes..." 
            className="search-input"
          />
          <div className="search-results">
            {/* Search results will go here */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
