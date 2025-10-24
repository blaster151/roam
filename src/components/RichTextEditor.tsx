/**
 * Rich text editor component using Draft.js
 * Based on requirements 1.1, 1.2, 1.9
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  SelectionState
} from 'draft-js';
import type { DraftHandleValue, DraftEditorCommand } from 'draft-js';
import { draftToMarkdown, markdownToDraft, isMarkdown } from '../utils';
import { createImageData } from '../utils/image';
import { EditorImage } from './EditorImage';
import 'draft-js/dist/Draft.css';
import './RichTextEditor.css';

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
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  initialContent,
  onChange,
  onMarkdownChange,
  placeholder = 'Start writing...',
  readOnly = false,
  autoFocus = false,
  supportMarkdown = true,
  supportImages = true
}) => {
  const editorRef = useRef<Editor>(null);
  

  
  // Initialize editor state
  const [editorState, setEditorState] = useState(() => {
    let initialState: EditorState;
    
    if (initialContent) {
      try {
        // Try to parse as JSON first (Draft.js raw content)
        const contentState = convertFromRaw(JSON.parse(initialContent));
        initialState = EditorState.createWithContent(contentState);
      } catch (error) {
        // If JSON parsing fails and markdown is supported, try parsing as markdown
        if (supportMarkdown && isMarkdown(initialContent)) {
          try {
            initialState = markdownToDraft(initialContent);
          } catch (markdownError) {
            console.warn('Failed to parse as markdown:', markdownError);
            initialState = EditorState.createEmpty();
          }
        } else {
          console.warn('Failed to parse initial content, using empty state:', error);
          initialState = EditorState.createEmpty();
        }
      }
    } else {
      initialState = EditorState.createEmpty();
    }
    
    // Note: Decorator will be applied when the editor renders
    return initialState;
  });

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
  }, []);

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

  // Handle key commands
  const handleKeyCommand = useCallback((
    command: DraftEditorCommand | string,
    editorStateParam: EditorState
  ): DraftHandleValue => {
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
  }, [handleCreateLink, handleEditorChange]);

  // Focus the editor
  const focusEditor = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, []);



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
