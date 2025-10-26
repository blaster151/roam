/**
 * Service layer exports for the Web Note App
 */

export type {
  IStorageService,
  StorageResult,
  StorageError,
  QueryOptions,
  StorageTransaction,
  StorageChangeEvent
} from './storage';

export { StorageErrorCode } from './storage';
export { IndexedDBStorageService } from './indexeddb-storage';
export { NoteService, type CreateNoteOptions, type UpdateNoteOptions, type ReorderNoteOptions } from './note-service';
export { LinkService, type BacklinkEntry } from './link-service';