import { useMemo, useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import type { Note } from '../types';
import { useNoteStore, useUIStore } from '../stores';
import './NoteSidebar.css';

const NOTE_DRAG_TYPE = 'note-item';

type DraggedNote = {
  id: string;
  parentId: string | null;
  order: number;
};

type DropPosition = 'before' | 'after' | 'inside';

const formatDateDisplay = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString();
};

interface NoteTreeItemProps {
  note: Note;
  depth: number;
  childCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
  isSelected: boolean;
  hasUnsavedChanges: boolean;
  moveNote: (id: string, targetParentId: string | null, targetIndex: number) => void;
  children?: ReactNode;
  getDescendants: (id: string) => Set<string>;
  setNoteCollapsed: (noteId: string, collapsed: boolean) => void;
}

const NoteTreeItem = ({
  note,
  depth,
  childCount,
  isCollapsed,
  onToggleCollapse,
  onSelect,
  isSelected,
  hasUnsavedChanges,
  moveNote,
  children,
  getDescendants,
  setNoteCollapsed
}: NoteTreeItemProps) => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const dropPositionRef = useRef<DropPosition | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const updateDropPosition = useCallback((position: DropPosition | null) => {
    dropPositionRef.current = position;
    setDropPosition(position);
  }, []);

  const canAcceptChildren = depth === 0;

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: NOTE_DRAG_TYPE,
      item: {
        id: note.id,
        parentId: note.parentId ?? null,
        order: note.order
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging()
      })
    }),
    [note.id, note.parentId, note.order]
  );

  const [{ isOver }, drop] = useDrop<DraggedNote, void, { isOver: boolean }>(
    () => ({
      accept: NOTE_DRAG_TYPE,
      canDrop: (item) => item.id !== note.id,
      hover: (item, monitor) => {
        const node = elementRef.current;
        if (!node) {
          return;
        }

        if (!monitor.isOver({ shallow: true })) {
          updateDropPosition(null);
          return;
        }

        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) {
          return;
        }

        const rect = node.getBoundingClientRect();
        const relativeY = clientOffset.y - rect.top;
        const threshold = rect.height / 3;

        let position: DropPosition = 'inside';
        if (relativeY < threshold) {
          position = 'before';
        } else if (relativeY > rect.height - threshold) {
          position = 'after';
        }

        if (item.id === note.id) {
          updateDropPosition(null);
          return;
        }

        if (position === 'inside') {
          const draggedDescendants = getDescendants(item.id);
          const wouldBeCircular = draggedDescendants.has(note.id);
          const exceedsDepth = depth >= 1;

          if (!canAcceptChildren || wouldBeCircular || exceedsDepth) {
            updateDropPosition(null);
            return;
          }
        } else {
          if (note.parentId === item.id) {
            updateDropPosition(null);
            return;
          }
        }

        updateDropPosition(position);
      },
      drop: (item, monitor) => {
        if (!monitor.isOver({ shallow: true })) {
          return;
        }

        const position = dropPositionRef.current;
        updateDropPosition(null);

        if (!position) {
          return;
        }

        if (position === 'inside') {
          const draggedDescendants = getDescendants(item.id);
          const wouldBeCircular = draggedDescendants.has(note.id);
          const exceedsDepth = depth >= 1;

          if (!canAcceptChildren || wouldBeCircular || exceedsDepth) {
            return;
          }

          moveNote(item.id, note.id, childCount);
          setNoteCollapsed(note.id, false);
          item.parentId = note.id;
          item.order = childCount;
          return;
        }

        const targetParentId = note.parentId ?? null;
        const targetIndex = position === 'before' ? note.order : note.order + 1;
        moveNote(item.id, targetParentId, targetIndex);
        item.parentId = targetParentId;
        item.order = targetIndex;
      },
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true })
      })
    }),
    [
      childCount,
      canAcceptChildren,
      depth,
      getDescendants,
      moveNote,
      note.id,
      note.order,
      note.parentId,
      setNoteCollapsed,
      updateDropPosition
    ]
  );

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      elementRef.current = node;
      if (node) {
        drop(node);
        drag(node);
      }
    },
    [drag, drop]
  );

  const dropClassName = dropPosition ? `note-item-drop-${dropPosition}` : '';
  const draggingClassName = isDragging ? 'note-item-dragging' : '';

  return (
    <div className={`note-tree-item depth-${depth}`}>
      <div
        ref={setRefs}
        className={`note-item ${isSelected ? 'selected' : ''} ${dropClassName} ${draggingClassName}`.trim()}
        onClick={onSelect}
      >
        <div className="note-item-header">
          {depth === 0 ? (
            childCount > 0 ? (
              <button
                type="button"
                className={`note-collapse-toggle ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleCollapse();
                }}
                aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
              >
                {isCollapsed ? '▸' : '▾'}
              </button>
            ) : (
              <span className="note-collapse-placeholder" aria-hidden="true" />
            )
          ) : (
            <span className="note-branch-spacer" aria-hidden="true" />
          )}
          <div className="note-item-title">{note.title}</div>
          <span
            className={`note-item-unsaved-indicator ${hasUnsavedChanges ? 'is-visible' : ''}`}
            role={hasUnsavedChanges ? 'img' : undefined}
            aria-label={hasUnsavedChanges ? 'Unsaved changes' : undefined}
            aria-hidden={hasUnsavedChanges ? undefined : true}
            title={hasUnsavedChanges ? 'Unsaved changes' : undefined}
          />
        </div>
        <div className="note-item-date">{formatDateDisplay(note.updatedAt)}</div>
      </div>
      {isOver && dropPosition === 'inside' && !isCollapsed && depth === 0 ? (
        <div className="note-drop-preview" aria-hidden="true" />
      ) : null}
      {!isCollapsed && children ? <div className="note-tree-children">{children}</div> : null}
    </div>
  );
};

interface NoteSidebarProps {
  onCreateNote: () => void;
  onToggleTheme?: () => void;
}

export const NoteSidebar = ({ onCreateNote, onToggleTheme }: NoteSidebarProps) => {
  const notes = useNoteStore((state) => state.notes);
  const selectNote = useNoteStore((state) => state.selectNote);
  const selectedNoteId = useNoteStore((state) => state.selectedNoteId);
  const unsavedChanges = useNoteStore((state) => state.unsavedChanges);
  const moveNote = useNoteStore((state) => state.moveNote);

  const toggleNoteCollapsed = useUIStore((state) => state.toggleNoteCollapsed);
  const isNoteCollapsed = useUIStore((state) => state.isNoteCollapsed);
  const setNoteCollapsed = useUIStore((state) => state.setNoteCollapsed);

  const notesByParent = useMemo(() => {
    const map = new Map<string | null, Note[]>();
    for (const note of notes) {
      const key = note.parentId ?? null;
      const siblings = map.get(key);
      if (siblings) {
        siblings.push(note);
      } else {
        map.set(key, [note]);
      }
    }

    for (const siblingList of map.values()) {
      siblingList.sort((a, b) => a.order - b.order);
    }

    return map;
  }, [notes]);

  const descendantMap = useMemo(() => {
    const map = new Map<string, Set<string>>();

    const visit = (noteId: string): Set<string> => {
      if (map.has(noteId)) {
        return map.get(noteId)!;
      }

      const descendants = new Set<string>();
      const children = notesByParent.get(noteId) ?? [];
      for (const child of children) {
        descendants.add(child.id);
        const childDescendants = visit(child.id);
        for (const descendant of childDescendants) {
          descendants.add(descendant);
        }
      }

      map.set(noteId, descendants);
      return descendants;
    };

    for (const note of notes) {
      visit(note.id);
    }

    return map;
  }, [notes, notesByParent]);

  const getDescendants = useCallback(
    (id: string) => descendantMap.get(id) ?? new Set<string>(),
    [descendantMap]
  );

  const renderNotes = (noteList: Note[], depth: number): ReactNode => {
    return noteList.map((note) => {
      const childNotes = notesByParent.get(note.id) ?? [];
      const collapsed = isNoteCollapsed(note.id);
      const hasUnsavedChanges = Boolean(unsavedChanges[note.id]);

      return (
        <NoteTreeItem
          key={note.id}
          note={note}
          depth={depth}
          childCount={childNotes.length}
          isCollapsed={collapsed}
          onToggleCollapse={() => toggleNoteCollapsed(note.id)}
          onSelect={() => selectNote(note.id)}
          isSelected={selectedNoteId === note.id}
          hasUnsavedChanges={hasUnsavedChanges}
          moveNote={moveNote}
          getDescendants={getDescendants}
          setNoteCollapsed={setNoteCollapsed}
        >
          {!collapsed && childNotes.length > 0 ? renderNotes(childNotes, depth + 1) : null}
        </NoteTreeItem>
      );
    });
  };

  const rootNotes = notesByParent.get(null) ?? [];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">Web Notes</h1>
        <button
          className="theme-toggle"
          title="Toggle theme"
          type="button"
          onClick={onToggleTheme}
        >
          🌙
        </button>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-actions">
          <button className="new-note-btn" onClick={onCreateNote}>
            + New Note
          </button>
        </div>

        <div className="notes-list">
          {rootNotes.length === 0 ? (
            <div className="notes-placeholder">
              <p>No notes yet</p>
              <p className="notes-placeholder-hint">Create your first note to get started</p>
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <div className="note-tree">{renderNotes(rootNotes, 0)}</div>
            </DndProvider>
          )}
        </div>
      </div>
    </aside>
  );
};
