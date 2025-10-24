/**
 * IndexedDB storage service implementation using Dexie.js
 * Based on requirements 6.3, 7.2
 */

import Dexie, { type Table, type Transaction } from 'dexie';
import type { Note, LinkEmbed } from '../types';
import type {
  IStorageService,
  StorageResult,
  QueryOptions,
  StorageTransaction,
  StorageChangeEvent
} from './storage';
import { StorageErrorCode } from './storage';
import type { StorageErrorCode as StorageErrorCodeType } from './storage';

/**
 * Database schema for IndexedDB storage
 */
class WebNoteDatabase extends Dexie {
  notes!: Table<Note>;
  embeds!: Table<LinkEmbed>;
  metadata!: Table<{ key: string; value: unknown }>;

  constructor() {
    super('WebNoteApp');
    
    this.version(1).stores({
      notes: 'id, title, parentId, order, createdAt, updatedAt, *links.outbound, *links.inbound',
      embeds: 'id, url, createdAt',
      metadata: 'key'
    });
  }
}

/**
 * IndexedDB transaction wrapper
 */
class IndexedDBTransaction implements StorageTransaction {
  private dexieTransaction: Transaction;

  constructor(dexieTransaction: Transaction) {
    this.dexieTransaction = dexieTransaction;
  }

  async commit(): Promise<StorageResult<void>> {
    try {
      // Dexie transactions auto-commit, so we just need to ensure no errors
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.TRANSACTION_FAILED,
          message: 'Failed to commit transaction',
          details: error
        }
      };
    }
  }

  async rollback(): Promise<StorageResult<void>> {
    try {
      this.dexieTransaction.abort();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.TRANSACTION_FAILED,
          message: 'Failed to rollback transaction',
          details: error
        }
      };
    }
  }
}

/**
 * IndexedDB storage service implementation
 */
export class IndexedDBStorageService implements IStorageService {
  private db: WebNoteDatabase;
  private changeListeners: ((event: StorageChangeEvent) => void)[] = [];

  constructor() {
    this.db = new WebNoteDatabase();
  }

  async initialize(): Promise<StorageResult<void>> {
    try {
      await this.db.open();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.STORAGE_UNAVAILABLE,
          message: 'Failed to initialize IndexedDB',
          details: error
        }
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      return this.db.isOpen();
    } catch {
      return false;
    }
  }

  async getStorageInfo(): Promise<StorageResult<{ used: number; available: number; quota: number }>> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return {
          success: true,
          data: {
            used: estimate.usage || 0,
            available: (estimate.quota || 0) - (estimate.usage || 0),
            quota: estimate.quota || 0
          }
        };
      }
      
      // Fallback for browsers without storage API
      return {
        success: true,
        data: { used: 0, available: Infinity, quota: Infinity }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: StorageErrorCode.UNKNOWN_ERROR,
          message: 'Failed to get storage info',
          details: error
        }
      };
    }
  }

  // Note operations

  async createNote(noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<StorageResult<Note>> {
    try {
      const now = new Date();
      const note: Note = {
        ...noteData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };

      await this.db.notes.add(note);
      this.notifyChange({ type: 'note', operation: 'create', id: note.id, data: note });
      
      return { success: true, data: note };
    } catch (error) {
      return this.handleError(error, 'Failed to create note');
    }
  }

  async getNote(id: string): Promise<StorageResult<Note>> {
    try {
      const note = await this.db.notes.get(id);
      if (!note) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `Note with id ${id} not found`
          }
        };
      }
      return { success: true, data: note };
    } catch (error) {
      return this.handleError(error, 'Failed to get note');
    }
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<StorageResult<Note>> {
    try {
      const existingNote = await this.db.notes.get(id);
      if (!existingNote) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `Note with id ${id} not found`
          }
        };
      }

      const updatedNote: Note = {
        ...existingNote,
        ...updates,
        id, // Ensure ID cannot be changed
        updatedAt: new Date()
      };

      await this.db.notes.put(updatedNote);
      this.notifyChange({ type: 'note', operation: 'update', id, data: updatedNote });
      
      return { success: true, data: updatedNote };
    } catch (error) {
      return this.handleError(error, 'Failed to update note');
    }
  }

  async deleteNote(id: string): Promise<StorageResult<void>> {
    try {
      await this.db.notes.delete(id);
      
      this.notifyChange({ type: 'note', operation: 'delete', id });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'Failed to delete note');
    }
  }

  async getNotes(options: QueryOptions = {}): Promise<StorageResult<Note[]>> {
    try {
      let query = this.db.notes.toCollection();

      // Apply parent filter
      if (options.parentId !== undefined) {
        query = query.filter(note => note.parentId === options.parentId);
      }

      let notes = await query.toArray();

      // Apply sorting
      if (options.sortBy) {
        notes = notes.sort((a, b) => {
          const aVal = a[options.sortBy!];
          const bVal = b[options.sortBy!];
          
          if (aVal < bVal) return options.sortOrder === 'desc' ? 1 : -1;
          if (aVal > bVal) return options.sortOrder === 'desc' ? -1 : 1;
          return 0;
        });
      }

      // Apply pagination
      if (options.offset || options.limit) {
        const start = options.offset || 0;
        const end = options.limit ? start + options.limit : undefined;
        notes = notes.slice(start, end);
      }
      return { success: true, data: notes };
    } catch (error) {
      return this.handleError(error, 'Failed to get notes');
    }
  }

  async getNotesByParent(parentId: string | null): Promise<StorageResult<Note[]>> {
    return this.getNotes({ parentId, sortBy: 'order', sortOrder: 'asc' });
  }

  async searchNotes(query: string): Promise<StorageResult<Note[]>> {
    try {
      const searchTerm = query.toLowerCase();
      const notes = await this.db.notes
        .filter(note => 
          note.title.toLowerCase().includes(searchTerm) ||
          note.content.toLowerCase().includes(searchTerm)
        )
        .toArray();
      
      return { success: true, data: notes };
    } catch (error) {
      return this.handleError(error, 'Failed to search notes');
    }
  }

  // Link embed operations

  async createEmbed(embedData: Omit<LinkEmbed, 'id' | 'createdAt'>): Promise<StorageResult<LinkEmbed>> {
    try {
      const embed: LinkEmbed = {
        ...embedData,
        id: crypto.randomUUID(),
        createdAt: new Date()
      };

      await this.db.embeds.add(embed);
      this.notifyChange({ type: 'embed', operation: 'create', id: embed.id, data: embed });
      
      return { success: true, data: embed };
    } catch (error) {
      return this.handleError(error, 'Failed to create embed');
    }
  }

  async getEmbed(id: string): Promise<StorageResult<LinkEmbed>> {
    try {
      const embed = await this.db.embeds.get(id);
      if (!embed) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `Embed with id ${id} not found`
          }
        };
      }
      return { success: true, data: embed };
    } catch (error) {
      return this.handleError(error, 'Failed to get embed');
    }
  }

  async updateEmbed(id: string, updates: Partial<LinkEmbed>): Promise<StorageResult<LinkEmbed>> {
    try {
      const existingEmbed = await this.db.embeds.get(id);
      if (!existingEmbed) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `Embed with id ${id} not found`
          }
        };
      }

      const updatedEmbed: LinkEmbed = {
        ...existingEmbed,
        ...updates,
        id // Ensure ID cannot be changed
      };

      await this.db.embeds.put(updatedEmbed);
      this.notifyChange({ type: 'embed', operation: 'update', id, data: updatedEmbed });
      
      return { success: true, data: updatedEmbed };
    } catch (error) {
      return this.handleError(error, 'Failed to update embed');
    }
  }

  async deleteEmbed(id: string): Promise<StorageResult<void>> {
    try {
      await this.db.embeds.delete(id);
      
      this.notifyChange({ type: 'embed', operation: 'delete', id });
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'Failed to delete embed');
    }
  }

  async getEmbedByUrl(url: string): Promise<StorageResult<LinkEmbed>> {
    try {
      const embed = await this.db.embeds.where('url').equals(url).first();
      if (!embed) {
        return {
          success: false,
          error: {
            code: StorageErrorCode.NOT_FOUND,
            message: `Embed with url ${url} not found`
          }
        };
      }
      return { success: true, data: embed };
    } catch (error) {
      return this.handleError(error, 'Failed to get embed by URL');
    }
  }

  // Transaction support

  async beginTransaction(): Promise<StorageResult<StorageTransaction>> {
    try {
      const transaction = await this.db.transaction(
        'rw',
        this.db.notes,
        this.db.embeds,
        (tx) => tx
      );

      return {
        success: true,
        data: new IndexedDBTransaction(transaction)
      };
    } catch (error) {
      return this.handleError(error, 'Failed to begin transaction');
    }
  }

  async executeTransaction<T>(
    operations: (transaction: StorageTransaction) => Promise<T>
  ): Promise<StorageResult<T>> {
    try {
      const result = await this.db.transaction('rw', this.db.notes, this.db.embeds, async (tx) => {
        const transaction = new IndexedDBTransaction(tx);
        return await operations(transaction);
      });
      
      return { success: true, data: result };
    } catch (error) {
      return this.handleError(error, 'Transaction failed');
    }
  }

  // Bulk operations

  async importNotes(notes: Note[]): Promise<StorageResult<void>> {
    try {
      await this.db.transaction('rw', this.db.notes, async () => {
        await this.db.notes.bulkPut(notes);
      });
      
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'Failed to import notes');
    }
  }

  async exportNotes(): Promise<StorageResult<Note[]>> {
    try {
      const notes = await this.db.notes.toArray();
      return { success: true, data: notes };
    } catch (error) {
      return this.handleError(error, 'Failed to export notes');
    }
  }

  async clearAll(): Promise<StorageResult<void>> {
    try {
      await this.db.transaction('rw', this.db.notes, this.db.embeds, this.db.metadata, async () => {
        await this.db.notes.clear();
        await this.db.embeds.clear();
        await this.db.metadata.clear();
      });
      
      return { success: true };
    } catch (error) {
      return this.handleError(error, 'Failed to clear all data');
    }
  }

  // Event handling

  onStorageChange(callback: (event: StorageChangeEvent) => void): () => void {
    this.changeListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(callback);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  // Private helper methods

  private notifyChange(event: StorageChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage change listener:', error);
      }
    });
  }

  private handleError(error: unknown, message: string): StorageResult<never> {
    console.error(message, error);
    
    let errorCode: StorageErrorCodeType = StorageErrorCode.UNKNOWN_ERROR;
    
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        errorCode = StorageErrorCode.QUOTA_EXCEEDED;
      } else if (error.name === 'NotFoundError') {
        errorCode = StorageErrorCode.NOT_FOUND;
      } else if (error.name === 'TransactionInactiveError') {
        errorCode = StorageErrorCode.TRANSACTION_FAILED;
      }
    }
    
    return {
      success: false,
      error: {
        code: errorCode,
        message,
        details: error
      }
    };
  }
}