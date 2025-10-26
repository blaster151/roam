/**
 * Rich text editor component using Draft.js
 * Based on requirements 1.1, 1.2, 1.9
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Editor,
  EditorState,
  RichUtils,
  getDefaultKeyBinding,
  KeyBindingUtil,
  convertToRaw,
  convertFromRaw,
  Modifier,
  AtomicBlockUtils,
  ContentBlock,
  ContentState,
  SelectionState,
  CompositeDecorator
} from 'draft-js';
import type { DraftHandleValue, DraftEditorCommand } from 'draft-js';
import { draftToMarkdown, markdownToDraft, isMarkdown } from '../utils';
import { createImageData } from '../utils/image';
import { EditorImage } from './EditorImage';
import 'draft-js/dist/Draft.css';
import './RichTextEditor.css';
import type { Note } from '../types';

interface ImageEntityData {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  id?: string;
}

const isValidDimension = (dimension: unknown): dimension is number =>
  typeof dimension === 'number' && Number.isFinite(dimension) && dimension > 0;

const isImageEntityData = (value: unknown): value is ImageEntityData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;
  const { src, alt, width, height, id } = data;

  if (typeof src !== 'string' || src.length === 0) {
    return false;
  }

  if (alt !== undefined && typeof alt !== 'string') {
    return false;
  }

  if (width !== undefined && !isValidDimension(width)) {
    return false;
  }

  if (height !== undefined && !isValidDimension(height)) {
    return false;
  }

  if (id !== undefined && typeof id !== 'string') {
    return false;
  }

  return true;
};

interface ImageBlockComponentProps {
  block: ContentBlock;
  contentState: ContentState;
  blockProps: {
    readOnly: boolean;
    data: ImageEntityData;
  };
}

interface ImageBlockRendererConfig {
  component: React.ComponentType<ImageBlockComponentProps>;
  editable: boolean;
  props: ImageBlockComponentProps['blockProps'];
}

interface LinkTrigger {
  blockKey: string;
  start: number;
}

export interface RichTextEditorProps {
  /** Initial content as Draft.js raw content state or Markdown */
  initialContent?: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when content changes with Markdown format */
  onMarkdownChange?: (markdown: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Auto-focus the editor on mount */
  autoFocus?: boolean;
  /** Support Markdown input/output */
  supportMarkdown?: boolean;
  /** Support image pasting */
  supportImages?: boolean;
  /** Notes available for cross-linking suggestions */
  notes?: Note[];
  /** Identifier of the currently edited note */
  currentNoteId?: string | null;
  /** Navigate to a linked note when clicked */
  onNoteLinkClick?: (noteId: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  onChange,
  onMarkdownChange,
  placeholder = 'Start writing...',
  readOnly = false,
  autoFocus = false,
  supportMarkdown = true,
  supportImages = true,
  notes = [],
  currentNoteId = null,
  onNoteLinkClick
}) => {
  const noteTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const note of notes) {
      map.set(note.id, note.title);
    }
    return map;
  }, [notes]);

  const noteLinkDecorator = useMemo(
    () =>
      new CompositeDecorator([
        {
          strategy: (block, callback, contentState) => {
            block.findEntityRanges(
              (character) => {
                const entityKey = character.getEntity();
                if (!entityKey) {
                  return false;
                }

                const entity = contentState.getEntity(entityKey);
                return entity.getType() === 'NOTE_LINK';
              },
              callback
            );
          },
          component: (props) => {
            const entity = props.contentState.getEntity(props.entityKey);
            const data = entity.getData() as { noteId?: string; title?: string };
            const noteId = typeof data.noteId === 'string' ? data.noteId : undefined;
            const childText = React.Children.toArray(props.children)
              .map((child) => (typeof child === 'string' ? child : ''))
              .join('');
            const fallbackTitle = typeof data.title === 'string' ? data.title : childText;
            const resolvedTitle =
              (noteId ? noteTitleMap.get(noteId) : undefined) ?? fallbackTitle ?? '';

            const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
              event.preventDefault();
              event.stopPropagation();
              if (noteId && onNoteLinkClick) {
                onNoteLinkClick(noteId);
              }
            };

            const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
              if (!noteId || !onNoteLinkClick) {
                return;
              }

              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onNoteLinkClick(noteId);
              }
            };

            return (
              <span
                className="note-link-entity"
                role={noteId ? 'link' : undefined}
                tabIndex={noteId ? 0 : -1}
                onClick={noteId ? handleClick : undefined}
                onKeyDown={noteId ? handleKeyDown : undefined}
              >
                {`[[${resolvedTitle}]]`}
              </span>
            );
          }
        }
      ]),
    [noteTitleMap, onNoteLinkClick]
  );

  const editorRef = useRef<Editor>(null);
  

  
  // Initialize editor state
  const [editorState, setEditorState] = useState(() => {
    let initialState: EditorState;

    if (initialContent) {
      try {
        // Try to parse as JSON first (Draft.js raw content)
        const contentState = convertFromRaw(JSON.parse(initialContent));
        initialState = EditorState.createWithContent(contentState, noteLinkDecorator);
      } catch (error) {
        // If JSON parsing fails and markdown is supported, try parsing as markdown
        if (supportMarkdown && isMarkdown(initialContent)) {
          try {
            const markdownState = markdownToDraft(initialContent);
            initialState = EditorState.createWithContent(
              markdownState.getCurrentContent(),
              noteLinkDecorator
            );
          } catch (markdownError) {
            console.warn('Failed to parse as markdown:', markdownError);
            initialState = EditorState.createEmpty(noteLinkDecorator);
          }
        } else {
          console.warn('Failed to parse initial content, using empty state:', error);
          initialState = EditorState.createEmpty(noteLinkDecorator);
        }
      }
    } else {
      initialState = EditorState.createEmpty(noteLinkDecorator);
    }

    return initialState;
  });

  useEffect(() => {
    setEditorState((prev) => EditorState.set(prev, { decorator: noteLinkDecorator }));
  }, [noteLinkDecorator]);

  const [linkTrigger, setLinkTrigger] = useState<LinkTrigger | null>(null);
  const [linkQuery, setLinkQuery] = useState('');
  const [isLinkMenuOpen, setIsLinkMenuOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const linkSuggestions = useMemo(() => {
    if (!linkTrigger) {
      return [];
    }

    const normalizedQuery = linkQuery.trim().toLowerCase();
    const candidates = notes.filter(note => note.id !== currentNoteId);
    const sorted = [...candidates].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    );

    if (!normalizedQuery) {
      return sorted.slice(0, 8);
    }

    return sorted
      .filter(note => note.title.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [linkTrigger, notes, currentNoteId, linkQuery]);

  useEffect(() => {
    if (selectedSuggestionIndex >= linkSuggestions.length && linkSuggestions.length > 0) {
      setSelectedSuggestionIndex(0);
    }
  }, [linkSuggestions, selectedSuggestionIndex]);

  // Handle editor state changes
  const handleEditorChange = useCallback((newEditorState: EditorState) => {
    setEditorState(newEditorState);
    
    // Call onChange callback with serialized content
    if (onChange) {
      const contentState = newEditorState.getCurrentContent();
      const rawContent = convertToRaw(contentState);
      onChange(JSON.stringify(rawContent));
    }
    
    // Call onMarkdownChange callback if supported
    if (onMarkdownChange && supportMarkdown) {
      const markdown = draftToMarkdown(newEditorState);
      onMarkdownChange(markdown);
    }
  }, [onChange, onMarkdownChange, supportMarkdown]);

  // Custom key bindings
  const keyBindingFn = useCallback((e: React.KeyboardEvent): string | null => {
    if (linkTrigger && isLinkMenuOpen) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          return 'link-autocomplete-down';
        case 'ArrowUp':
          e.preventDefault();
          return 'link-autocomplete-up';
        case 'Enter':
          return 'link-autocomplete-select';
        case 'Tab':
          e.preventDefault();
          return 'link-autocomplete-select';
        case 'Escape':
          return 'link-autocomplete-cancel';
        default:
          break;
      }
    }

    // Handle custom shortcuts
    if (KeyBindingUtil.hasCommandModifier(e)) {
      switch (e.keyCode) {
        case 66: // Ctrl+B
          return 'bold';
        case 73: // Ctrl+I
          return 'italic';
        case 75: // Ctrl+K
          return 'link';
        default:
          break;
      }
    }

    return getDefaultKeyBinding(e);
  }, [isLinkMenuOpen, linkTrigger]);

  const handleCreateLink = useCallback(() => {
    const run = async () => {
      const selection = editorState.getSelection();

      if (selection.isCollapsed()) {
        const url = prompt('Enter URL:');
        if (!url) return;

        const linkText = prompt('Enter link text:', url);
        if (!linkText) return;

        const contentState = editorState.getCurrentContent();
        const contentStateWithEntity = contentState.createEntity('LINK', 'MUTABLE', { url });
        const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

        const newContentState = Modifier.insertText(
          contentStateWithEntity,
          selection,
          linkText,
          undefined,
          entityKey
        );

        const newEditorState = EditorState.push(
          editorState,
          newContentState,
          'insert-characters'
        );

        handleEditorChange(newEditorState);
        return;
      }

      let defaultUrl = '';
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        try {
          const clipboardText = await navigator.clipboard.readText();
          if (
            clipboardText &&
            (clipboardText.startsWith('http://') || clipboardText.startsWith('https://'))
          ) {
            defaultUrl = clipboardText;
          }
        } catch {
          // Ignore clipboard errors
        }
      }

      const url = prompt('Enter URL:', defaultUrl);
      if (!url) return;

      const contentState = editorState.getCurrentContent();
      const contentStateWithEntity = contentState.createEntity('LINK', 'MUTABLE', { url });
      const entityKey = contentStateWithEntity.getLastCreatedEntityKey();

      const newContentState = Modifier.applyEntity(
        contentStateWithEntity,
        selection,
        entityKey
      );

      const newEditorState = EditorState.push(
        editorState,
        newContentState,
        'apply-entity'
      );

      handleEditorChange(newEditorState);
    };

    void run();
  }, [editorState, handleEditorChange]);

  const focusEditor = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);

  const cancelLinkAutocomplete = useCallback(() => {
    setLinkTrigger(null);
    setLinkQuery('');
    setIsLinkMenuOpen(false);
    setSelectedSuggestionIndex(0);
  }, []);

  const insertNoteLink = useCallback(
    (targetNote: Note) => {
      if (!linkTrigger) {
        return;
      }

      const selection = editorState.getSelection();
      if (!selection.isCollapsed() || selection.getStartKey() !== linkTrigger.blockKey) {
        return;
      }

      const blockKey = linkTrigger.blockKey;
      const startOffset = linkTrigger.start;
      const endOffset = selection.getStartOffset();

      let contentState = editorState.getCurrentContent();
      contentState = contentState.createEntity('NOTE_LINK', 'IMMUTABLE', {
        noteId: targetNote.id,
        title: targetNote.title
      });
      const entityKey = contentState.getLastCreatedEntityKey();

      const updatedContent = Modifier.replaceText(
        contentState,
        SelectionState.createEmpty(blockKey).merge({
          anchorOffset: startOffset,
          focusOffset: endOffset
        }) as SelectionState,
        `[[${targetNote.title}]]`,
        undefined,
        entityKey
      );

      const newEditorState = EditorState.push(
        editorState,
        updatedContent,
        'insert-characters'
      );

      handleEditorChange(newEditorState);
      cancelLinkAutocomplete();
      setTimeout(focusEditor, 0);
    },
    [cancelLinkAutocomplete, editorState, focusEditor, handleEditorChange, linkTrigger]
  );

  // Handle key commands
  const handleKeyCommand = useCallback((
    command: DraftEditorCommand | string,
    editorStateParam: EditorState
  ): DraftHandleValue => {
    if (linkTrigger && isLinkMenuOpen) {
      if (command === 'link-autocomplete-down') {
        if (linkSuggestions.length > 0) {
          setSelectedSuggestionIndex((prev) => (prev + 1) % linkSuggestions.length);
        }
        return 'handled';
      }

      if (command === 'link-autocomplete-up') {
        if (linkSuggestions.length > 0) {
          setSelectedSuggestionIndex((prev) =>
            (prev - 1 + linkSuggestions.length) % linkSuggestions.length
          );
        }
        return 'handled';
      }

      if (command === 'link-autocomplete-select') {
        if (linkSuggestions.length > 0) {
          const suggestion =
            linkSuggestions[selectedSuggestionIndex] ?? linkSuggestions[0];
          insertNoteLink(suggestion);
        } else {
          const normalizedQuery = linkQuery.trim().toLowerCase();
          if (normalizedQuery.length > 0) {
            const exactMatch = notes
              .filter(note => note.id !== currentNoteId)
              .find(note => note.title.toLowerCase() === normalizedQuery);

            if (exactMatch) {
              insertNoteLink(exactMatch);
            } else {
              cancelLinkAutocomplete();
            }
          } else {
            cancelLinkAutocomplete();
          }
        }
        return 'handled';
      }

      if (command === 'link-autocomplete-cancel') {
        cancelLinkAutocomplete();
        return 'handled';
      }
    }

    // Handle rich text commands
    const newState = RichUtils.handleKeyCommand(
      editorStateParam,
      command as DraftEditorCommand
    );

    if (newState) {
      handleEditorChange(newState);
      return 'handled';
    }

    // Handle custom commands
    switch (command) {
      case 'bold':
        handleEditorChange(RichUtils.toggleInlineStyle(editorStateParam, 'BOLD'));
        return 'handled';
      case 'italic':
        handleEditorChange(RichUtils.toggleInlineStyle(editorStateParam, 'ITALIC'));
        return 'handled';
      case 'link':
        handleCreateLink();
        return 'handled';
      default:
        return 'not-handled';
    }
  }, [
    cancelLinkAutocomplete,
    currentNoteId,
    handleCreateLink,
    handleEditorChange,
    insertNoteLink,
    isLinkMenuOpen,
    linkQuery,
    linkSuggestions,
    linkTrigger,
    notes,
    selectedSuggestionIndex
  ]);

  const handleBeforeInput = useCallback(
    (chars: string): DraftHandleValue => {
      if (readOnly) {
        return 'not-handled';
      }

      if (chars === '[') {
        const selection = editorState.getSelection();
        if (!selection.isCollapsed()) {
          return 'not-handled';
        }

        const block = editorState.getCurrentContent().getBlockForKey(selection.getStartKey());
        const offset = selection.getStartOffset();
        const previousChar = block.getText().slice(Math.max(0, offset - 1), offset);

        if (previousChar === '[') {
          setLinkTrigger({ blockKey: selection.getStartKey(), start: offset - 1 });
          setSelectedSuggestionIndex(0);
          setIsLinkMenuOpen(true);
        }

        return 'not-handled';
      }

      if (linkTrigger && (chars === ' ' || chars === '\n')) {
        cancelLinkAutocomplete();
      }

      return 'not-handled';
    },
    [cancelLinkAutocomplete, editorState, linkTrigger, readOnly]
  );

  useEffect(() => {
    if (!linkTrigger) {
      return;
    }

    const selection = editorState.getSelection();
    if (!selection.isCollapsed() || selection.getStartKey() !== linkTrigger.blockKey) {
      cancelLinkAutocomplete();
      return;
    }

    const block = editorState.getCurrentContent().getBlockForKey(linkTrigger.blockKey);
    const currentOffset = selection.getStartOffset();

    if (currentOffset < linkTrigger.start + 2) {
      cancelLinkAutocomplete();
      return;
    }

    if (block.getText().slice(linkTrigger.start, linkTrigger.start + 2) !== '[[') {
      cancelLinkAutocomplete();
      return;
    }

    const rawQuery = block.getText().slice(linkTrigger.start + 2, currentOffset);
    if (rawQuery.includes('\n')) {
      cancelLinkAutocomplete();
      return;
    }

    if (rawQuery.endsWith(']]')) {
      const candidate = rawQuery.slice(0, -2).trim();
      if (candidate.length === 0) {
        cancelLinkAutocomplete();
        return;
      }

      const exactMatch = notes
        .filter(note => note.id !== currentNoteId)
        .find(note => note.title.toLowerCase() === candidate.toLowerCase());

      if (exactMatch) {
        insertNoteLink(exactMatch);
        return;
      }

      cancelLinkAutocomplete();
      return;
    }

    setLinkQuery(rawQuery);
    setIsLinkMenuOpen(true);
  }, [
    cancelLinkAutocomplete,
    currentNoteId,
    editorState,
    insertNoteLink,
    linkTrigger,
    notes
  ]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure the component is fully mounted
      setTimeout(focusEditor, 100);
    }
  }, [autoFocus, focusEditor]);

  // Get current inline styles for toolbar state
  const currentInlineStyle = editorState.getCurrentInlineStyle();
  const isBold = currentInlineStyle.has('BOLD');
  const isItalic = currentInlineStyle.has('ITALIC');

  // Toggle formatting functions
  const toggleBold = useCallback(() => {
    handleEditorChange(RichUtils.toggleInlineStyle(editorState, 'BOLD'));
  }, [editorState, handleEditorChange]);

  const toggleItalic = useCallback(() => {
    handleEditorChange(RichUtils.toggleInlineStyle(editorState, 'ITALIC'));
  }, [editorState, handleEditorChange]);

  // Handle link creation
  // Handle paste events
  const handlePastedText = useCallback((text: string, html?: string): DraftHandleValue => {
    // If markdown is supported and the pasted text looks like markdown, parse it
    if (supportMarkdown && isMarkdown(text)) {
      try {
        const markdownEditorState = markdownToDraft(text);
        const markdownContent = markdownEditorState.getCurrentContent();
        
        // Insert the parsed markdown content at the current selection
        const currentContent = editorState.getCurrentContent();
        const selection = editorState.getSelection();
        
        const newContent = Modifier.replaceWithFragment(
          currentContent,
          selection,
          markdownContent.getBlockMap()
        );
        
        const newEditorState = EditorState.push(
          editorState,
          newContent,
          'insert-fragment'
        );
        
        handleEditorChange(newEditorState);
        return 'handled';
      } catch (error) {
        console.warn('Failed to parse pasted markdown:', error);
      }
    }
    
    // For HTML content, let Draft.js handle it naturally
    if (html) {
      return 'not-handled';
    }
    
    // For plain text, insert normally
    const currentContent = editorState.getCurrentContent();
    const selection = editorState.getSelection();
    
    const newContent = Modifier.insertText(
      currentContent,
      selection,
      text
    );
    
    const newEditorState = EditorState.push(
      editorState,
      newContent,
      'insert-characters'
    );
    
    handleEditorChange(newEditorState);
    return 'handled';
  }, [editorState, handleEditorChange, supportMarkdown]);

  // Handle pasted files (images) - async processing
  const processImageFiles = useCallback(async (files: File[]) => {
    if (!supportImages) {
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      return;
    }

    try {
      // Process images one by one
      let currentEditorState = editorState;
      
      for (const imageFile of imageFiles) {
        const imageData = await createImageData(imageFile);
        
        // Create entity for the image
        const contentStateWithEntity = currentEditorState
          .getCurrentContent()
          .createEntity('IMAGE', 'IMMUTABLE', {
            src: imageData.dataUrl,
            alt: imageData.originalName || 'Pasted image',
            width: imageData.width,
            height: imageData.height,
            id: imageData.id
          });
        
        const entityKey = contentStateWithEntity.getLastCreatedEntityKey();
        
        // Insert atomic block with the image
        currentEditorState = AtomicBlockUtils.insertAtomicBlock(
          EditorState.set(currentEditorState, { currentContent: contentStateWithEntity }),
          entityKey,
          ' '
        );
      }
      
      handleEditorChange(currentEditorState);
    } catch (error) {
      console.error('Failed to process pasted images:', error);
    }
  }, [editorState, handleEditorChange, supportImages]);

  // Handle pasted files (synchronous handler)
  const handlePastedFiles = useCallback((files: Blob[]): DraftHandleValue => {
    if (!supportImages) {
      return 'not-handled';
    }

    const fileArray = Array.from(files) as File[];
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      return 'not-handled';
    }

    // Process images asynchronously
    processImageFiles(imageFiles);
    return 'handled';
  }, [processImageFiles, supportImages]);

  // Handle drop events for images (synchronous handler)
  const handleDroppedFiles = useCallback((
    _selection: SelectionState,
    files: Blob[]
  ): DraftHandleValue => {
    return handlePastedFiles(files);
  }, [handlePastedFiles]);

  // Custom block renderer for images
  const blockRendererFn = useCallback(
    (block: ContentBlock): ImageBlockRendererConfig | null => {
      if (block.getType() === 'atomic') {
        const entityKey = block.getEntityAt(0);
        if (!entityKey) {
          return null;
        }

        const entity = editorState.getCurrentContent().getEntity(entityKey);

        if (entity.getType() === 'IMAGE') {
          const data = entity.getData();

          if (!isImageEntityData(data)) {
            console.warn('Encountered image entity with invalid data. Skipping render.', data);
            return null;
          }

          return {
            component: ImageBlock,
            editable: false,
            props: {
              readOnly,
              data
            }
          };
        }
      }

      return null;
    },
    [editorState, readOnly]
  );



  return (
    <div className="rich-text-editor">
      {/* Formatting Toolbar */}
      {!readOnly && (
        <div className="editor-toolbar">
          <button
            type="button"
            className={`toolbar-button ${isBold ? 'active' : ''}`}
            onClick={toggleBold}
            title="Bold (Ctrl+B)"
            aria-label="Bold"
          >
            <strong>B</strong>
          </button>
          
          <button
            type="button"
            className={`toolbar-button ${isItalic ? 'active' : ''}`}
            onClick={toggleItalic}
            title="Italic (Ctrl+I)"
            aria-label="Italic"
          >
            <em>I</em>
          </button>
          
          <button
            type="button"
            className="toolbar-button"
            onClick={handleCreateLink}
            title="Create Link (Ctrl+K)"
            aria-label="Create Link"
          >
            🔗
          </button>
        </div>
      )}

      {/* Editor Container */}
      <div 
        className="editor-container"
        onClick={focusEditor}
      >
        <Editor
          ref={editorRef}
          editorState={editorState}
          onChange={handleEditorChange}
          handleBeforeInput={handleBeforeInput}
          keyBindingFn={keyBindingFn}
          handleKeyCommand={handleKeyCommand}
          handlePastedText={handlePastedText}
          handlePastedFiles={handlePastedFiles}
          handleDroppedFiles={handleDroppedFiles}
          blockRendererFn={blockRendererFn}
          placeholder={placeholder}
          readOnly={readOnly}
          spellCheck={true}
        />
        {isLinkMenuOpen ? (
          <div className="note-link-autocomplete" role="listbox">
            {linkSuggestions.length === 0 ? (
              <div className="note-link-autocomplete-empty">No matching notes</div>
            ) : (
              linkSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className={`note-link-autocomplete-option${
                    index === selectedSuggestionIndex ? ' selected' : ''
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertNoteLink(suggestion);
                  }}
                >
                  {suggestion.title || 'Untitled Note'}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

// Image block component for atomic blocks
const ImageBlock: React.FC<ImageBlockComponentProps> = ({
  block,
  blockProps
}) => {
  const entityKey = block.getEntityAt(0);

  if (!entityKey) {
    return null;
  }

  return (
    <EditorImage
      src={blockProps.data.src}
      alt={blockProps.data.alt}
      width={blockProps.data.width}
      height={blockProps.data.height}
      readOnly={blockProps.readOnly}
    />
  );
};
