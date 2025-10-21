/**
 * Abstract storage service interface for future migration flexibility
 * Based on requirements 6.3, 7.2
 */

import type { Note, LinkEmbed } from '../types';

/**
 * Result wrapper for storage operations with error handling
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: StorageError;
}

/**
 * Storage operation error details
 */
export interface StorageError {
  code: StorageErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Storage error codes for different failure scenarios
 */
export const StorageErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type StorageErrorCode = typeof StorageErrorCode[keyof typeof StorageErrorCode];

/**
 * Query options for filtering and sorting notes
 */
export interface QueryOptions {
  /** Filter by parent ID (null for root notes) */
  parentId?: string | null;
  
  /** Sort field */
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'order';
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  
  /** Limit number of results */
  limit?: number;
  
  /** Skip number of results */
  offset?: number;
}

/**
 * Transaction context for atomic operations
 */
export interface StorageTransaction {
  /** Commit the transaction */
  commit(): Promise<StorageResult<void>>;
  
  /** Rollback the transaction */
  rollback(): Promise<StorageResult<void>>;
}

/**
 * Abstract storage service interface that can be implemented
 * for different storage backends (IndexedDB, localStorage, cloud storage)
 */
export interface IStorageService {
  /**
   * Initialize the storage service
   */
  initialize(): Promise<StorageResult<void>>;
  
  /**
   * Check if storage is available and functional
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * Get storage usage information
   */
  getStorageInfo(): Promise<StorageResult<{
    used: number;
    available: number;
    quota: number;
  }>>;
  
  // Note operations
  
  /**
   * Create a new note
   */
  createNote(note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<Note>>;
  
  /**
   * Get a note by ID
   */
  getNote(id: string): Promise<StorageResult<Note>>;
  
  /**
   * Update an existing note
   */
  updateNote(id: string, updates: Partial<Note>): Promise<StorageResult<Note>>;
  
  /**
   * Delete a note by ID
   */
  deleteNote(id: string): Promise<StorageResult<void>>;
  
  /**
   * Get all notes with optional filtering and sorting
   */
  getNotes(options?: QueryOptions): Promise<StorageResult<Note[]>>;
  
  /**
   * Get notes by parent ID (for hierarchical organization)
   */
  getNotesByParent(parentId: string | null): Promise<StorageResult<Note[]>>;
  
  /**
   * Search notes by content
   */
  searchNotes(query: string): Promise<StorageResult<Note[]>>;
  
  // Link embed operations
  
  /**
   * Create a new link embed
   */
  createEmbed(embed: Omit<LinkEmbed, 'id' | 'createdAt'>): Promise<StorageResult<LinkEmbed>>;
  
  /**
   * Get a link embed by ID
   */
  getEmbed(id: string): Promise<StorageResult<LinkEmbed>>;
  
  /**
   * Update an existing link embed
   */
  updateEmbed(id: string, updates: Partial<LinkEmbed>): Promise<StorageResult<LinkEmbed>>;
  
  /**
   * Delete a link embed by ID
   */
  deleteEmbed(id: string): Promise<StorageResult<void>>;
  
  /**
   * Get embed by URL (for caching)
   */
  getEmbedByUrl(url: string): Promise<StorageResult<LinkEmbed>>;
  
  // Transaction support
  
  /**
   * Begin a new transaction for atomic operations
   */
  beginTransaction(): Promise<StorageResult<StorageTransaction>>;
  
  /**
   * Execute multiple operations in a transaction
   */
  executeTransaction<T>(
    operations: (transaction: StorageTransaction) => Promise<T>
  ): Promise<StorageResult<T>>;
  
  // Bulk operations
  
  /**
   * Import notes from external data
   */
  importNotes(notes: Note[]): Promise<StorageResult<void>>;
  
  /**
   * Export all notes
   */
  exportNotes(): Promise<StorageResult<Note[]>>;
  
  /**
   * Clear all data (for testing or reset)
   */
  clearAll(): Promise<StorageResult<void>>;
  
  // Event handling for reactive updates
  
  /**
   * Subscribe to storage changes
   */
  onStorageChange(callback: (event: StorageChangeEvent) => void): () => void;
}

/**
 * Storage change event for reactive updates
 */
export interface StorageChangeEvent {
  type: 'note' | 'embed';
  operation: 'create' | 'update' | 'delete';
  id: string;
  data?: Note | LinkEmbed;
}