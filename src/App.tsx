/**
 * Main App component with layout, keyboard shortcuts, and welcome screen
 * Based on requirements 1.4, 1.5, 1.6
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useUIStore, useThemeStore, useNoteStore } from './stores';
import { WelcomeScreen, RichTextEditor } from './components';
import './App.css';

const formatDateDisplay = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString();
};

const formatSaveTimestamp = (timestamp: number | null) => {
  if (!timestamp) {
    return '';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function App() {
  const { showWelcomeScreen } = useUIStore();
  const { getEffectiveTheme } = useThemeStore();
  const {
    getSelectedNote,
    getNoteById,
    addNote,
    selectNote,
    notes,
    updateNote,
    saveStatus,
    saveError,
    lastSavedAt,
    unsavedChanges,
    setSaveStatus,
    setSaveError,
    setLastSavedAt,
    recordUnsavedChanges,
    clearUnsavedChanges,
    getUnsavedChanges
  } = useNoteStore();

  const selectedNote = getSelectedNote();
  const selectedNoteId = selectedNote?.id ?? null;

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const draftTitleRef = useRef('');
  const draftContentRef = useRef('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousNoteIdRef = useRef<string | null>(null);

  const cancelAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const flushAutosave = useCallback(
    (targetNoteId?: string) => {
      const noteIdToFlush = targetNoteId ?? selectedNoteId;

      if (!noteIdToFlush) {
        if (targetNoteId === undefined) {
          cancelAutosaveTimer();
        }
        return;
      }

      const isCurrentNote = noteIdToFlush === selectedNoteId;

      if (isCurrentNote) {
        cancelAutosaveTimer();
      }

      const pendingChanges = getUnsavedChanges(noteIdToFlush);
      if (!pendingChanges) {
        return;
      }

      const baselineNote = getNoteById(noteIdToFlush);

      if (!baselineNote && !isCurrentNote) {
        clearUnsavedChanges(noteIdToFlush);
        return;
      }

      const resolvedTitle =
        pendingChanges.title ??
        (isCurrentNote
          ? draftTitleRef.current
          : baselineNote?.title ?? '');

      const resolvedContent =
        pendingChanges.content ??
        (isCurrentNote
          ? draftContentRef.current
          : baselineNote?.content ?? '');

      if (
        baselineNote &&
        baselineNote.title === resolvedTitle &&
        baselineNote.content === resolvedContent
      ) {
        clearUnsavedChanges(noteIdToFlush);

        if (isCurrentNote) {
          setLastSavedAt(Date.now());
          setSaveStatus('saved');
          setSaveError(null);
        }

        return;
      }

      try {
        updateNote(noteIdToFlush, {
          title: resolvedTitle,
          content: resolvedContent
        });

        clearUnsavedChanges(noteIdToFlush);

        if (isCurrentNote) {
          setLastSavedAt(Date.now());
          setSaveStatus('saved');
          setSaveError(null);
        }
      } catch (error) {
        console.error('Failed to save note', error);

        if (isCurrentNote) {
          setSaveStatus('error');
          setSaveError(
            error instanceof Error ? error.message : 'Failed to save changes'
          );
        }

        recordUnsavedChanges(noteIdToFlush, {
          title: resolvedTitle,
          content: resolvedContent
        });
      }
    },
    [
      cancelAutosaveTimer,
      clearUnsavedChanges,
      getNoteById,
      getUnsavedChanges,
      recordUnsavedChanges,
      selectedNoteId,
      setLastSavedAt,
      setSaveError,
      setSaveStatus,
      updateNote
    ]
  );

  const scheduleAutosave = useCallback((noteId: string, titleValue: string, contentValue: string) => {
    cancelAutosaveTimer();

    recordUnsavedChanges(noteId, {
      title: titleValue,
      content: contentValue
    });

    const currentNote = getSelectedNote();
    if (
      currentNote &&
      currentNote.id === noteId &&
      currentNote.title === titleValue &&
      currentNote.content === contentValue
    ) {
      clearUnsavedChanges(noteId);
      setSaveStatus('saved');
      setSaveError(null);
      return;
    }

    setSaveStatus('saving');
    setSaveError(null);

    autosaveTimerRef.current = setTimeout(() => {
      try {
        updateNote(noteId, {
          title: titleValue,
          content: contentValue
        });

        clearUnsavedChanges(noteId);
        setLastSavedAt(Date.now());
        setSaveStatus('saved');
        setSaveError(null);
      } catch (error) {
        console.error('Failed to save note', error);
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
        recordUnsavedChanges(noteId, {
          title: titleValue,
          content: contentValue
        });
      } finally {
        autosaveTimerRef.current = null;
      }
    }, 2000);
  }, [
    cancelAutosaveTimer,
    clearUnsavedChanges,
    getSelectedNote,
    recordUnsavedChanges,
    setLastSavedAt,
    setSaveError,
    setSaveStatus,
    updateNote
  ]);

  const flushAllUnsaved = useCallback(() => {
    flushAutosave();
    Object.keys(unsavedChanges).forEach(noteId => {
      if (noteId !== selectedNoteId) {
        flushAutosave(noteId);
      }
    });
  }, [flushAutosave, selectedNoteId, unsavedChanges]);

  useEffect(() => () => {
    flushAllUnsaved();
  }, [flushAllUnsaved]);

  useEffect(() => {
    const previousId = previousNoteIdRef.current;
    if (previousId && previousId !== selectedNoteId) {
      flushAutosave(previousId);
    }

    previousNoteIdRef.current = selectedNoteId;
  }, [flushAutosave, selectedNoteId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      flushAllUnsaved();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAllUnsaved();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushAllUnsaved]);

  useEffect(() => {
    if (!selectedNoteId) {
      cancelAutosaveTimer();
      setDraftTitle('');
      setDraftContent('');
      draftTitleRef.current = '';
      draftContentRef.current = '';
      setSaveStatus('idle');
      setSaveError(null);
      setLastSavedAt(null);
      return;
    }

    cancelAutosaveTimer();

    const currentNote = getSelectedNote();
    if (!currentNote) {
      setDraftTitle('');
      setDraftContent('');
      draftTitleRef.current = '';
      draftContentRef.current = '';
      setSaveStatus('idle');
      setSaveError(null);
      setLastSavedAt(null);
      return;
    }

    const unsaved = getUnsavedChanges(selectedNoteId);
    const nextTitle = unsaved?.title ?? currentNote.title;
    const nextContent = unsaved?.content ?? currentNote.content;

    setDraftTitle(nextTitle);
    setDraftContent(nextContent);
    draftTitleRef.current = nextTitle;
    draftContentRef.current = nextContent;
    setEditorKey((key) => key + 1);

    if (unsaved) {
      setSaveStatus('error');
      setSaveError('Unsaved changes restored');
      setLastSavedAt(null);
    } else {
      setSaveStatus('saved');
      setSaveError(null);
      setLastSavedAt(
        currentNote.updatedAt instanceof Date
          ? currentNote.updatedAt.getTime()
          : new Date(currentNote.updatedAt).getTime()
      );
    }
  }, [
    cancelAutosaveTimer,
    getSelectedNote,
    getUnsavedChanges,
    selectedNoteId,
    setLastSavedAt,
    setSaveError,
    setSaveStatus
  ]);

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

  const handleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setDraftTitle(value);
    draftTitleRef.current = value;

    if (selectedNoteId) {
      scheduleAutosave(selectedNoteId, value, draftContentRef.current);
    }
  }, [scheduleAutosave, selectedNoteId]);

  const handleContentChange = useCallback((content: string) => {
    setDraftContent(content);
    draftContentRef.current = content;

    if (selectedNoteId) {
      scheduleAutosave(selectedNoteId, draftTitleRef.current, content);
    }
  }, [scheduleAutosave, selectedNoteId]);

  // Show welcome screen for first-time users
  if (showWelcomeScreen) {
    return <WelcomeScreen />;
  }

  const saveStatusClass = saveStatus === 'idle' ? 'saved' : saveStatus;
  let saveStatusMessage = '';

  switch (saveStatus) {
    case 'saving':
      saveStatusMessage = 'Saving changes…';
      break;
    case 'saved':
    case 'idle':
      saveStatusMessage = lastSavedAt
        ? `Saved at ${formatSaveTimestamp(lastSavedAt)}`
        : 'All changes saved';
      break;
    case 'error':
      saveStatusMessage = saveError || 'Failed to save changes';
      break;
    default:
      saveStatusMessage = '';
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
                  {notes.map(note => {
                    const hasUnsavedChanges = Boolean(unsavedChanges[note.id]);

                    return (
                      <div
                        key={note.id}
                        className={`note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
                        onClick={() => selectNote(note.id)}
                      >
                        <div className="note-item-header">
                          <div className="note-item-title">{note.title}</div>
                          <span
                            className={`note-item-unsaved-indicator ${hasUnsavedChanges ? 'is-visible' : ''}`}
                            role={hasUnsavedChanges ? 'img' : undefined}
                            aria-label={hasUnsavedChanges ? 'Unsaved changes' : undefined}
                            aria-hidden={hasUnsavedChanges ? undefined : true}
                            title={hasUnsavedChanges ? 'Unsaved changes' : undefined}
                          />
                        </div>
                        <div className="note-item-date">
                          {formatDateDisplay(note.updatedAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main className="main-content">
          <div className="editor-container">
            {selectedNote ? (
              <div className="editor-wrapper">
                <div className="note-header">
                  <input
                    type="text"
                    className="note-title-input"
                    placeholder="Note title..."
                    value={draftTitle}
                    onChange={handleTitleChange}
                  />
                  <div className={`save-status save-status-${saveStatusClass}`} role="status" aria-live="polite">
                    <span className="save-status-indicator" aria-hidden="true" />
                    <span className="save-status-message">{saveStatusMessage}</span>
                  </div>
                </div>
                <RichTextEditor
                  key={selectedNoteId ? `${selectedNoteId}-${editorKey}` : 'editor'}
                  initialContent={draftContent}
                  placeholder="Start writing your note..."
                  autoFocus={true}
                  supportMarkdown={true}
                  supportImages={true}
                  onChange={handleContentChange}
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
