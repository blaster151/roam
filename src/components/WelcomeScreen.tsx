/**
 * Welcome screen component for first-time users
 * Based on requirements 7.1, 7.5
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useUIStore, useNoteStore } from '../stores';
import type { Note } from '../types';
import { parseNotesBackup } from '../utils';
import './WelcomeScreen.css';

export const WelcomeScreen: React.FC = () => {
  const { dismissWelcomeScreen } = useUIStore();
  const setNotes = useNoteStore((state) => state.setNotes);
  const selectNote = useNoteStore((state) => state.selectNote);
  const setSaveStatus = useNoteStore((state) => state.setSaveStatus);
  const setSaveError = useNoteStore((state) => state.setSaveError);
  const setLastSavedAt = useNoteStore((state) => state.setLastSavedAt);
  const noteCount = useNoteStore((state) => state.notes.length);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ used: number; quota: number } | null>(null);
  const [storageStatus, setStorageStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    let isMounted = true;

    const readStorageInfo = async () => {
      if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
        setStorageStatus('error');
        return;
      }

      try {
        const estimate = await navigator.storage.estimate();
        if (!isMounted) {
          return;
        }

        setStorageInfo({
          used: estimate.usage ?? 0,
          quota: estimate.quota ?? 0
        });
        setStorageStatus('idle');
      } catch (error) {
        console.error('Failed to read storage info', error);
        if (isMounted) {
          setStorageStatus('error');
        }
      }
    };

    readStorageInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatBytes = useCallback((bytes: number): string => {
    if (!Number.isFinite(bytes) || bytes < 0) {
      return '0 B';
    }

    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(value < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
  }, []);

  const applyImportedNotes = useCallback((notes: Note[]) => {
    setNotes(notes);
    if (notes.length > 0) {
      selectNote(notes[0].id);
    } else {
      selectNote(null);
    }
    setSaveStatus('saved');
    setSaveError(null);
    setLastSavedAt(Date.now());
    useNoteStore.setState({ unsavedChanges: {} });
  }, [selectNote, setLastSavedAt, setNotes, setSaveError, setSaveStatus]);

  const handleGetStarted = () => {
    dismissWelcomeScreen();
  };

  const handleImportClick = () => {
    setImportStatus('idle');
    setImportMessage('');
    fileInputRef.current?.click();
  };

  const handleImportChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      setIsImporting(true);
      setImportStatus('idle');
      setImportMessage('');

      try {
        const content = await file.text();
        const { notes, metadata } = parseNotesBackup(content);

        applyImportedNotes(notes);
        setImportStatus('success');
        setImportMessage(
          metadata.noteCount === 1
            ? 'Imported 1 note successfully'
            : `Imported ${metadata.noteCount} notes successfully`
        );
        dismissWelcomeScreen();
      } catch (error) {
        console.error('Failed to import backup', error);
        setImportStatus('error');
        setImportMessage(
          error instanceof Error ? error.message : 'Unable to import the selected backup file'
        );
      } finally {
        setIsImporting(false);
        event.target.value = '';
      }
    },
    [applyImportedNotes, dismissWelcomeScreen]
  );

  const createSampleNotes = useCallback((): Note[] => {
    const now = new Date();
    const introId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `note-${Date.now().toString(36)}-intro`;
    const tipsId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `note-${Date.now().toString(36)}-tips`;
    const childId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `note-${Date.now().toString(36)}-child`;

    return [
      {
        id: introId,
        title: 'Welcome to Web Notes',
        content:
          '# Start capturing your ideas\n\n- Use **bold**, *italic*, and `code` formatting\n- Paste images directly into the editor\n- Type `[[` to link to other notes as your graph grows',
        createdAt: now,
        updatedAt: now,
        order: 0,
        links: { outbound: [], inbound: [] },
        embeds: []
      },
      {
        id: tipsId,
        title: 'Productivity Tips',
        content:
          '## Quick tips\n\n1. Press `Ctrl + B` to toggle bold text.\n2. Organize related ideas using drag and drop in the sidebar.\n3. Everything saves automatically — no sync required.',
        createdAt: now,
        updatedAt: now,
        order: 1,
        links: { outbound: [], inbound: [] },
        embeds: []
      },
      {
        id: childId,
        title: 'Nested Notes',
        content:
          'Child notes let you group supporting details. Try adding more to build out your outline!',
        createdAt: now,
        updatedAt: now,
        parentId: introId,
        order: 0,
        links: { outbound: [], inbound: [] },
        embeds: []
      }
    ];
  }, []);

  const handleLoadSampleNotes = useCallback(() => {
    const samples = createSampleNotes();
    applyImportedNotes(samples);
    dismissWelcomeScreen();
  }, [applyImportedNotes, createSampleNotes, dismissWelcomeScreen]);

  const importButtonLabel = useMemo(() => (isImporting ? 'Importing…' : 'Import Backup'), [isImporting]);

  const features = [
    {
      icon: '📝',
      title: 'Rich Text Editing',
      description: 'Create notes with Markdown support and rich formatting. Paste images directly into your notes.'
    },
    {
      icon: '🔗',
      title: 'Bi-directional Links',
      description: 'Connect your thoughts with bi-directional links between notes. See backlinks automatically.'
    },
    {
      icon: '🌐',
      title: 'Smart Web Embeds',
      description: 'Paste web URLs to get beautiful previews with titles, descriptions, and images.'
    },
    {
      icon: '📁',
      title: 'Hierarchical Organization',
      description: 'Organize notes in a sidebar with drag-and-drop. Create parent-child relationships up to 2 levels.'
    },
    {
      icon: '🔍',
      title: 'Powerful Search',
      description: 'Find any note instantly with full-text search across all your content.'
    },
    {
      icon: '💾',
      title: 'Auto-save Everything',
      description: 'Never lose your work. All changes are automatically saved locally in your browser.'
    },
    {
      icon: '🌙',
      title: 'Dark Mode',
      description: 'Switch between light and dark themes for comfortable writing in any lighting.'
    },
    {
      icon: '⚡',
      title: 'Works Offline',
      description: 'No internet required after loading. All your data stays private on your device.'
    }
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <h1 className="welcome-title">
            Welcome to <span className="app-name">Web Note App</span>
          </h1>
          <p className="welcome-subtitle">
            Your personal knowledge management system that works entirely in your browser
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
      ))}
    </div>

    <div className="welcome-actions">
      <button
        className="get-started-button"
        onClick={handleGetStarted}
      >
        Get Started
      </button>
      <p className="privacy-note">
        🔒 All your data stays on your device. No accounts, no tracking, no servers.
      </p>
    </div>

    <div className="welcome-secondary-actions">
      <div className="welcome-secondary-card">
        <h3>Bring your existing notes</h3>
        <p>Import a backup that you previously exported to continue where you left off.</p>
        <div className="welcome-secondary-actions-row">
          <button
            type="button"
            className="welcome-secondary-button"
            onClick={handleImportClick}
            disabled={isImporting}
          >
            {importButtonLabel}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="welcome-import-input"
            onChange={handleImportChange}
          />
        </div>
        {importStatus === 'error' ? (
          <p className="welcome-status-message welcome-status-error">{importMessage}</p>
        ) : null}
        {importStatus === 'success' ? (
          <p className="welcome-status-message welcome-status-success">{importMessage}</p>
        ) : null}
      </div>

      <div className="welcome-secondary-card">
        <h3>Explore sample notes</h3>
        <p>Load a short guided tour that shows how outlining and linking works.</p>
        <button
          type="button"
          className="welcome-secondary-button"
          onClick={handleLoadSampleNotes}
          disabled={noteCount > 0}
        >
          Load sample content
        </button>
        {noteCount > 0 ? (
          <p className="welcome-status-message welcome-status-muted">
            Sample notes are only available when starting with an empty workspace.
          </p>
        ) : null}
      </div>
    </div>

    <div className="welcome-storage-info">
      <h3>Your notes stay local</h3>
      <p>
        Data is stored in your browser using IndexedDB so you can work offline without creating an
        account.
      </p>
      {storageStatus === 'loading' ? (
        <p className="welcome-status-message welcome-status-muted">Checking available storage…</p>
      ) : null}
      {storageStatus === 'error' ? (
        <p className="welcome-status-message welcome-status-muted">
          Storage usage details are unavailable in this browser.
        </p>
      ) : null}
      {storageStatus === 'idle' && storageInfo ? (
        <dl className="welcome-storage-grid">
          <div>
            <dt>Used</dt>
            <dd>{formatBytes(storageInfo.used)}</dd>
          </div>
          <div>
            <dt>Available</dt>
            <dd>{formatBytes(Math.max(storageInfo.quota - storageInfo.used, 0))}</dd>
          </div>
          <div>
            <dt>Total quota</dt>
            <dd>{formatBytes(storageInfo.quota)}</dd>
          </div>
        </dl>
      ) : null}
    </div>

    <div className="keyboard-shortcuts">
      <h3>Quick Keyboard Shortcuts</h3>
      <div className="shortcuts-grid">
        <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>B</kbd>
              <span>Bold text</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>I</kbd>
              <span>Italic text</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Create link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};