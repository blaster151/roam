import { convertFromRaw, convertToRaw, Modifier, SelectionState } from 'draft-js';
import type { RawDraftContentState } from 'draft-js';
import type { Note } from '../types';

const NOTE_LINK_ENTITY_TYPE = 'NOTE_LINK';

interface LinkAnalysisResult {
  outbound: Set<string>;
  content: string;
}

interface BacklinkEntry {
  sourceId: string;
  sourceTitle: string;
  excerpts: string[];
}

const parseRawContent = (raw: string): RawDraftContentState | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as RawDraftContentState;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const sanitizeLinkId = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const ensureUniqueSorted = (values: Iterable<string>, titleMap: Map<string, string>): string[] => {
  const unique = new Set<string>();
  for (const value of values) {
    if (titleMap.has(value)) {
      unique.add(value);
    }
  }

  return Array.from(unique).sort((a, b) => {
    const titleA = titleMap.get(a) ?? '';
    const titleB = titleMap.get(b) ?? '';
    return titleA.localeCompare(titleB, undefined, { sensitivity: 'base' });
  });
};

const findLinkEntityRanges = (
  contentState: ReturnType<typeof convertFromRaw>,
  blockKey: string
): Array<{
  start: number;
  end: number;
  entityKey: string;
}> => {
  const block = contentState.getBlockForKey(blockKey);
  const ranges: Array<{ start: number; end: number; entityKey: string }> = [];

  block.findEntityRanges(
    (character) => {
      const entityKey = character.getEntity();
      if (!entityKey) {
        return false;
      }

      return contentState.getEntity(entityKey).getType() === NOTE_LINK_ENTITY_TYPE;
    },
    (start, end) => {
      const entityKey = block.getEntityAt(start);
      if (!entityKey) {
        return;
      }

      ranges.push({ start, end, entityKey });
    }
  );

  return ranges;
};

const replaceTextForRange = (
  contentState: ReturnType<typeof convertFromRaw>,
  blockKey: string,
  start: number,
  end: number,
  entityKey: string | null | undefined,
  text: string
) => {
  const selection = SelectionState.createEmpty(blockKey).merge({
    anchorOffset: start,
    focusOffset: end
  }) as SelectionState;

  if (entityKey) {
    return Modifier.replaceText(contentState, selection, text, undefined, entityKey);
  }

  return Modifier.replaceText(contentState, selection, text);
};

const gatherLinkExcerpts = (
  contentState: ReturnType<typeof convertFromRaw>,
  blockKey: string,
  targetNoteId: string
): string[] => {
  const block = contentState.getBlockForKey(blockKey);
  const ranges = findLinkEntityRanges(contentState, blockKey);
  const excerpts: string[] = [];

  for (const range of ranges) {
    const entity = contentState.getEntity(range.entityKey);
    const noteId = sanitizeLinkId((entity.getData() as Record<string, unknown>)?.noteId);
    if (noteId !== targetNoteId) {
      continue;
    }

    const blockText = block.getText();
    const contextStart = Math.max(0, range.start - 40);
    const contextEnd = Math.min(blockText.length, range.end + 40);
    const snippet = blockText.slice(contextStart, contextEnd).trim();

    if (snippet.length > 0) {
      excerpts.push(snippet);
    }
  }

  return excerpts;
};

const analyzeNoteContent = (
  note: Note,
  titleMap: Map<string, string>
): LinkAnalysisResult => {
  const raw = parseRawContent(note.content);
  if (!raw) {
    return { outbound: new Set(), content: note.content };
  }

  let contentState: ReturnType<typeof convertFromRaw>;
  try {
    contentState = convertFromRaw(raw);
  } catch {
    return { outbound: new Set(), content: note.content };
  }

  const outbound = new Set<string>();
  const blockKeys = contentState.getBlockMap().keySeq().toArray();

  for (const blockKey of blockKeys) {
    const ranges = findLinkEntityRanges(contentState, blockKey);
    if (ranges.length === 0) {
      continue;
    }

    // Sort descending to avoid offset issues when replacing text
    ranges.sort((a, b) => b.start - a.start);

    for (const range of ranges) {
      const entity = contentState.getEntity(range.entityKey);
      const data = (entity.getData() ?? {}) as Record<string, unknown>;
      const noteId = sanitizeLinkId(data.noteId);
      const storedTitle = typeof data.title === 'string' ? data.title : undefined;
      const hasTarget = Boolean(noteId && titleMap.has(noteId));

      if (hasTarget && noteId) {
        outbound.add(noteId);
      }

      const resolvedTitle = hasTarget
        ? titleMap.get(noteId as string) ?? storedTitle ?? 'Untitled'
        : storedTitle ?? 'Untitled';
      const displayText = `[[${resolvedTitle}]]`;

      if (hasTarget && noteId) {
        contentState = contentState.mergeEntityData(range.entityKey, {
          noteId,
          title: resolvedTitle
        });
      }

      contentState = replaceTextForRange(
        contentState,
        blockKey,
        range.start,
        range.end,
        hasTarget ? range.entityKey : null,
        displayText
      );
    }
  }

  const serialized = JSON.stringify(convertToRaw(contentState));
  return { outbound, content: serialized };
};

const extractBacklinks = (targetNoteId: string, notes: Note[]): BacklinkEntry[] => {
  const entries: BacklinkEntry[] = [];

  for (const note of notes) {
    if (note.id === targetNoteId) {
      continue;
    }

    const raw = parseRawContent(note.content);
    if (!raw) {
      continue;
    }

    let contentState: ReturnType<typeof convertFromRaw>;
    try {
      contentState = convertFromRaw(raw);
    } catch {
      continue;
    }

    const blockKeys = contentState.getBlockMap().keySeq().toArray();
    const excerpts: string[] = [];

    for (const blockKey of blockKeys) {
      const blockExcerpts = gatherLinkExcerpts(contentState, blockKey, targetNoteId);
      excerpts.push(...blockExcerpts);
    }

    if (excerpts.length > 0) {
      entries.push({
        sourceId: note.id,
        sourceTitle: note.title,
        excerpts
      });
    }
  }

  return entries;
};

export class LinkService {
  static reconcileNoteLinks(notes: Note[]): Note[] {
    if (notes.length === 0) {
      return notes;
    }

    const titleMap = new Map<string, string>();
    for (const note of notes) {
      titleMap.set(note.id, note.title);
    }

    const outboundMap = new Map<string, Set<string>>();
    const contentMap = new Map<string, string>();

    for (const note of notes) {
      const { outbound, content } = analyzeNoteContent(note, titleMap);
      outboundMap.set(note.id, outbound);
      contentMap.set(note.id, content);
    }

    const inboundMap = new Map<string, Set<string>>();
    for (const note of notes) {
      inboundMap.set(note.id, new Set());
    }

    for (const [sourceId, outbound] of outboundMap) {
      for (const targetId of outbound) {
        if (targetId === sourceId) {
          continue;
        }

        const inboundSet = inboundMap.get(targetId);
        if (inboundSet) {
          inboundSet.add(sourceId);
        }
      }
    }

    return notes.map((note) => {
      const outbound = ensureUniqueSorted(outboundMap.get(note.id) ?? [], titleMap);
      const inbound = ensureUniqueSorted(inboundMap.get(note.id) ?? [], titleMap);
      const updatedContent = contentMap.get(note.id) ?? note.content;

      const linksChanged =
        outbound.join('\u0000') !== (note.links?.outbound ?? []).join('\u0000') ||
        inbound.join('\u0000') !== (note.links?.inbound ?? []).join('\u0000');

      const contentChanged = updatedContent !== note.content;

      if (!linksChanged && !contentChanged) {
        return note;
      }

      return {
        ...note,
        content: contentChanged ? updatedContent : note.content,
        links: {
          outbound,
          inbound
        }
      };
    });
  }

  static getBacklinks(noteId: string, notes: Note[]): BacklinkEntry[] {
    if (!noteId) {
      return [];
    }

    return extractBacklinks(noteId, notes);
  }
}

export type { BacklinkEntry };
