/**
 * Note service with business logic for note management
 * Based on requirements 4.4, 6.1
 */

import type { Note } from '../types';
import type { IStorageService, StorageResult } from './storage';

export interface CreateNoteOptions {
  title?: string;
  content?: string;
  parentId?: string;
}

export interface UpdateNoteOptions {
  title?: string;
  content?: string;
  parentId?: string;
}

export interface ReorderNoteOptions {
  targetParentId?: string | null;
  targetOrder: number;
}

export class NoteService {
  private storage: IStorageService;
  
  constructor(storage: IStorageService) {
    this.storage = storage;
  }
  
  /**
   * Create a new note with automatic ordering
   */
  async createNote(options: CreateNoteOptions = {}): Promise<StorageResult<Note>> {
    const { title = 'Untitled Note', content = '', parentId } = options;
    
    // Validate parent exists and nesting level
    if (parentId) {
      const parentResult = await this.storage.getNote(parentId);
      if (!parentResult.success || !parentResult.data) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Parent note not found'
          }
        };
      }
      
      // Check nesting level - only allow 2 levels (parent -> child)
      if (parentResult.data.parentId) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot nest notes more than 2 levels deep'
          }
        };
      }
    }
    
    // Get next order position for the parent level
    const siblingsResult = await this.storage.getNotesByParent(parentId || null);
    if (!siblingsResult.success) {
      return {
        success: false,
        error: siblingsResult.error
      };
    }
    
    const nextOrder = siblingsResult.data!.length;
    
    // Create the note
    return await this.storage.createNote({
      title,
      content,
      parentId,
      order: nextOrder,
      links: {
        outbound: [],
        inbound: []
      },
      embeds: []
    });
  }
  
  /**
   * Update an existing note
   */
  async updateNote(id: string, options: UpdateNoteOptions): Promise<StorageResult<Note>> {
    
    // If changing parent, validate the new parent
    if (options.parentId !== undefined) {
      const parentId = options.parentId;
      if (parentId) {
        const parentResult = await this.storage.getNote(parentId);
        if (!parentResult.success || !parentResult.data) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Parent note not found'
            }
          };
        }
        
        // Check nesting level
        if (parentResult.data.parentId) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot nest notes more than 2 levels deep'
            }
          };
        }
        
        // Prevent circular references
        if (parentId === id) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Note cannot be its own parent'
            }
          };
        }
        
        // Check if the note being moved is a parent of the target parent
        const isCircular = await this.wouldCreateCircularReference(id, parentId);
        if (isCircular) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot create circular reference'
            }
          };
        }
      }
      
      // If changing parent, we need to reorder
      const currentNoteResult = await this.storage.getNote(id);
      if (!currentNoteResult.success || !currentNoteResult.data) {
        return {
          success: false,
          error: currentNoteResult.error
        };
      }
      
      const currentNote = currentNoteResult.data;
      
      // If parent is changing, get new order position
      if (currentNote.parentId !== parentId) {
        const newSiblingsResult = await this.storage.getNotesByParent(parentId || null);
        if (!newSiblingsResult.success) {
          return {
            success: false,
            error: newSiblingsResult.error
          };
        }
        
        const newOrder = newSiblingsResult.data!.length;
        
        // Update with new parent and order
        return await this.storage.updateNote(id, {
          ...options,
          parentId,
          order: newOrder
        });
      }
    }
    
    return await this.storage.updateNote(id, options);
  }
  
  /**
   * Delete a note and handle hierarchical cleanup
   */
  async deleteNote(id: string): Promise<StorageResult<void>> {
    // Get the note to be deleted
    const noteResult = await this.storage.getNote(id);
    if (!noteResult.success || !noteResult.data) {
      return noteResult as StorageResult<void>;
    }
    
    const note = noteResult.data;
    
    // Get all child notes
    const childrenResult = await this.storage.getNotesByParent(id);
    if (!childrenResult.success) {
      return childrenResult as StorageResult<void>;
    }
    
    // Move children to the parent's level (or root if no parent)
    const children = childrenResult.data!;
    for (const child of children) {
      const updateResult = await this.storage.updateNote(child.id, {
        parentId: note.parentId || undefined
      });
      if (!updateResult.success) {
        return updateResult as StorageResult<void>;
      }
    }
    
    // Delete the note itself
    return await this.storage.deleteNote(id);
  }
  
  /**
   * Reorder a note within its current parent or move to a new parent
   */
  async reorderNote(
    noteId: string, 
    options: ReorderNoteOptions
  ): Promise<StorageResult<Note>> {
    const { targetParentId, targetOrder } = options;
    
    // Get the note being moved
    const noteResult = await this.storage.getNote(noteId);
    if (!noteResult.success || !noteResult.data) {
      return noteResult as StorageResult<Note>;
    }
    
    const note = noteResult.data;
    
    // Validate target parent if specified
    if (targetParentId !== undefined && targetParentId !== null) {
      const parentResult = await this.storage.getNote(targetParentId);
      if (!parentResult.success || !parentResult.data) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Target parent note not found'
          }
        };
      }
      
      // Check nesting level
      if (parentResult.data.parentId) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot nest notes more than 2 levels deep'
          }
        };
      }
      
      // Prevent circular references
      const isCircular = await this.wouldCreateCircularReference(noteId, targetParentId);
      if (isCircular) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Cannot create circular reference'
          }
        };
      }
    }
    
    const newParentId = targetParentId === undefined ? note.parentId : targetParentId;
    
    // Get siblings in the target parent
    const siblingsResult = await this.storage.getNotesByParent(newParentId || null);
    if (!siblingsResult.success) {
      return {
        success: false,
        error: siblingsResult.error
      };
    }
    
    let siblings = siblingsResult.data!;
    
    // Remove the note being moved from siblings if it's in the same parent
    if (note.parentId === newParentId) {
      siblings = siblings.filter(s => s.id !== noteId);
    }
    
    // Validate target order
    const maxOrder = siblings.length;
    const clampedOrder = Math.max(0, Math.min(maxOrder, targetOrder));
    
    // Update orders for affected siblings
    const updates: Array<{ id: string; order: number }> = [];
    
    // Shift siblings to make room
    siblings.forEach((sibling, index) => {
      const newOrder = index >= clampedOrder ? index + 1 : index;
      if (sibling.order !== newOrder) {
        updates.push({ id: sibling.id, order: newOrder });
      }
    });
    
    // Apply sibling updates
    for (const update of updates) {
      await this.storage.updateNote(update.id, { order: update.order });
    }
    
    // Update the moved note
    return await this.storage.updateNote(noteId, {
      parentId: newParentId || undefined,
      order: clampedOrder
    });
  }
  
  /**
   * Get notes organized by hierarchy
   */
  async getNotesHierarchy(): Promise<StorageResult<Note[]>> {
    const allNotesResult = await this.storage.getNotes();
    if (!allNotesResult.success) {
      return allNotesResult;
    }
    
    const notes = allNotesResult.data!;
    
    // Sort notes by parent-child relationship and order
    const rootNotes = notes
      .filter(note => !note.parentId)
      .sort((a, b) => a.order - b.order);
    
    const result: Note[] = [];
    
    for (const rootNote of rootNotes) {
      result.push(rootNote);
      
      // Add children
      const children = notes
        .filter(note => note.parentId === rootNote.id)
        .sort((a, b) => a.order - b.order);
      
      result.push(...children);
    }
    
    return {
      success: true,
      data: result
    };
  }
  
  /**
   * Check if moving a note would create a circular reference
   */
  private async wouldCreateCircularReference(
    noteId: string, 
    targetParentId: string
  ): Promise<boolean> {
    // Get all descendants of the note being moved
    const descendants = await this.getAllDescendants(noteId);
    
    // Check if target parent is in the descendants
    return descendants.includes(targetParentId);
  }
  
  /**
   * Get all descendant note IDs recursively
   */
  private async getAllDescendants(noteId: string): Promise<string[]> {
    const childrenResult = await this.storage.getNotesByParent(noteId);
    if (!childrenResult.success) {
      return [];
    }
    
    const children = childrenResult.data!;
    const descendants: string[] = [];
    
    for (const child of children) {
      descendants.push(child.id);
      const childDescendants = await this.getAllDescendants(child.id);
      descendants.push(...childDescendants);
    }
    
    return descendants;
  }
}