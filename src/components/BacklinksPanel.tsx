import { useMemo } from 'react';
import type { Note } from '../types';
import { LinkService, type BacklinkEntry } from '../services';
import './BacklinksPanel.css';

interface BacklinksPanelProps {
  noteId: string | null;
  notes: Note[];
  onNavigate: (noteId: string) => void;
}

const LIMIT_PER_NOTE = 3;

export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  noteId,
  notes,
  onNavigate
}) => {
  const backlinks = useMemo<BacklinkEntry[]>(() => {
    if (!noteId) {
      return [];
    }

    return LinkService.getBacklinks(noteId, notes);
  }, [noteId, notes]);

  if (!noteId) {
    return (
      <aside className="backlinks-panel">
        <h3 className="backlinks-title">Linked References</h3>
        <p className="backlinks-placeholder">Select a note to see which pages reference it.</p>
      </aside>
    );
  }

  return (
    <aside className="backlinks-panel">
      <h3 className="backlinks-title">Linked References</h3>
      {backlinks.length === 0 ? (
        <p className="backlinks-placeholder">No other notes link to this note yet.</p>
      ) : (
        <ul className="backlinks-list">
          {backlinks.map((entry) => {
            const excerpts = entry.excerpts.slice(0, LIMIT_PER_NOTE);
            return (
              <li key={entry.sourceId} className="backlinks-item">
                <button
                  type="button"
                  className="backlinks-note-button"
                  onClick={() => onNavigate(entry.sourceId)}
                >
                  {entry.sourceTitle || 'Untitled Note'}
                </button>
                <ul className="backlinks-excerpts">
                  {excerpts.map((excerpt, index) => (
                    <li key={index} className="backlinks-excerpt">
                      {excerpt}
                    </li>
                  ))}
                  {entry.excerpts.length > LIMIT_PER_NOTE ? (
                    <li className="backlinks-excerpt backlinks-excerpt-more">…more references in this note</li>
                  ) : null}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
};
