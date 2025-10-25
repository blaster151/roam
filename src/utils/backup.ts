import type { Note, LinkEmbed } from '../types';

export const NOTES_BACKUP_VERSION = 1;

interface SerializedLinkEmbed {
  id: string;
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
  createdAt: string;
}

interface SerializedNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  parentId?: string | null;
  order: number;
  links?: {
    outbound?: unknown;
    inbound?: unknown;
  };
  embeds?: unknown[];
}

export interface NotesBackupFile {
  version: number;
  exportedAt: string;
  notes: SerializedNote[];
}

export interface ParsedNotesBackup {
  notes: Note[];
  metadata: {
    version: number;
    exportedAt?: Date;
    noteCount: number;
  };
}

const generateId = (prefix: string): string => {
  const randomUUID =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : '';

  if (randomUUID) {
    return randomUUID;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const ensureString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const ensureOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const ensureNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const parseDate = (value: unknown, fallback?: Date): Date => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (fallback) {
    return fallback;
  }

  return new Date();
};

const parseLinkArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<string[]>((result, entry) => {
    if (typeof entry === 'string') {
      result.push(entry);
    }
    return result;
  }, []);
};

const parseEmbed = (value: unknown, index: number): LinkEmbed | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const embed = value as Record<string, unknown>;
  const url = ensureString(embed.url);
  if (!url) {
    return null;
  }

  const createdAt = parseDate(embed.createdAt, new Date());

  return {
    id: ensureString(embed.id, generateId(`embed-${index}`)),
    url,
    title: ensureOptionalString(embed.title),
    description: ensureOptionalString(embed.description),
    image: ensureOptionalString(embed.image),
    favicon: ensureOptionalString(embed.favicon),
    siteName: ensureOptionalString(embed.siteName),
    createdAt
  };
};

const parseNote = (value: unknown, index: number): Note => {
  if (!value || typeof value !== 'object') {
    throw new Error('Encountered invalid note entry in backup');
  }

  const note = value as Record<string, unknown>;

  const title = ensureString(note.title, 'Untitled Note');
  const content = ensureString(note.content, '');
  const createdAt = parseDate(note.createdAt);
  const updatedAt = parseDate(note.updatedAt, createdAt);
  const order = ensureNumber(note.order, index);

  const rawParentId = note.parentId;
  const parentId = typeof rawParentId === 'string' && rawParentId.length > 0
    ? rawParentId
    : null;

  const rawEmbeds = Array.isArray(note.embeds) ? note.embeds : [];
  const embeds = rawEmbeds
    .map((embed, embedIndex) => parseEmbed(embed, embedIndex))
    .filter((embed): embed is LinkEmbed => Boolean(embed));

  return {
    id: ensureString(note.id, generateId(`note-${index}`)),
    title,
    content,
    createdAt,
    updatedAt,
    parentId: parentId ?? undefined,
    order,
    links: {
      outbound: parseLinkArray(note.links && (note.links as Record<string, unknown>).outbound),
      inbound: parseLinkArray(note.links && (note.links as Record<string, unknown>).inbound)
    },
    embeds
  };
};

export const createNotesBackup = (notes: Note[]): NotesBackupFile => {
  const exportedAt = new Date().toISOString();

  const serializedNotes: SerializedNote[] = notes.map((note) => ({
    id: note.id,
    title: note.title,
    content: note.content,
    createdAt: note.createdAt instanceof Date ? note.createdAt.toISOString() : new Date(note.createdAt).toISOString(),
    updatedAt: note.updatedAt instanceof Date ? note.updatedAt.toISOString() : new Date(note.updatedAt).toISOString(),
    parentId: note.parentId ?? null,
    order: note.order,
    links: {
      outbound: note.links?.outbound ?? [],
      inbound: note.links?.inbound ?? []
    },
    embeds: (note.embeds ?? []).map<SerializedLinkEmbed>((embed) => ({
      id: embed.id,
      url: embed.url,
      title: embed.title,
      description: embed.description,
      image: embed.image,
      favicon: embed.favicon,
      siteName: embed.siteName,
      createdAt: embed.createdAt instanceof Date ? embed.createdAt.toISOString() : new Date(embed.createdAt).toISOString()
    }))
  }));

  return {
    version: NOTES_BACKUP_VERSION,
    exportedAt,
    notes: serializedNotes
  };
};

export const parseNotesBackup = (raw: string): ParsedNotesBackup => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file has an unexpected structure');
  }

  const data = parsed as Partial<NotesBackupFile>;

  if (typeof data.version !== 'number') {
    throw new Error('Backup file is missing a version number');
  }

  if (!Array.isArray(data.notes)) {
    throw new Error('Backup file does not include any notes');
  }

  const notes = data.notes.map((note, index) => parseNote(note, index));

  const exportedAtDate = data.exportedAt ? parseDate(data.exportedAt) : undefined;

  return {
    notes,
    metadata: {
      version: data.version,
      exportedAt: exportedAtDate,
      noteCount: notes.length
    }
  };
};
