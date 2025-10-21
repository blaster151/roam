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