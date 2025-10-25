/**
 * Utility function exports
 */

export {
  draftToMarkdown,
  rawContentToMarkdown,
  markdownToDraft,
  markdownToRawContent,
  isMarkdown
} from './markdown';

export {
  fileToBase64,
  isValidImageFile,
  getImageDimensions,
  resizeImageIfNeeded,
  extractImagesFromClipboard,
  generateImageId,
  createImageData,
  type ImageData
} from './image';

export {
  createNotesBackup,
  parseNotesBackup,
  NOTES_BACKUP_VERSION,
  type NotesBackupFile,
  type ParsedNotesBackup
} from './backup';