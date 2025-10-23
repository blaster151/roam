/**
 * Image component for the rich text editor
 * Based on requirements 1.7
 */

import React, { useState, useCallback } from 'react';
import './EditorImage.css';

export interface EditorImageProps {
  /** Image data URL or source */
  src: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Whether the image is selected */
  selected?: boolean;
  /** Callback when image is clicked */
  onClick?: () => void;
  /** Callback when image should be deleted */
  onDelete?: () => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

export const EditorImage: React.FC<EditorImageProps> = ({
  src,
  alt = 'Image',
  width,
  height,
  selected = false,
  onClick,
  onDelete,
  readOnly = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.();
  }, [onClick]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete?.();
    }
  }, [onDelete]);

  if (hasError) {
    return (
      <div className="editor-image-error">
        <div className="error-icon">🖼️</div>
        <div className="error-text">Failed to load image</div>
        {!readOnly && onDelete && (
          <button
            className="delete-button"
            onClick={handleDelete}
            title="Remove image"
            aria-label="Remove image"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`editor-image-container ${selected ? 'selected' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={selected ? 0 : -1}
      role="button"
      aria-label={`Image: ${alt}`}
    >
      {isLoading && (
        <div className="image-loading">
          <div className="loading-spinner"></div>
          <div className="loading-text">Loading image...</div>
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className="editor-image"
        draggable={false}
      />
      
      {selected && !readOnly && onDelete && (
        <button
          className="delete-button"
          onClick={handleDelete}
          title="Remove image"
          aria-label="Remove image"
        >
          ✕
        </button>
      )}
      
      {selected && (
        <div className="selection-overlay" />
      )}
    </div>
  );
};