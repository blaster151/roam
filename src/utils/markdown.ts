/**
 * Markdown conversion utilities for Draft.js
 * Based on requirements 1.1, 1.3
 */

import { 
  EditorState, 
  convertToRaw, 
  convertFromRaw
} from 'draft-js';
import type {
  RawDraftContentState,
  RawDraftInlineStyleRange,
  RawDraftEntityRange
} from 'draft-js';

/**
 * Convert Draft.js content to Markdown
 */
export function draftToMarkdown(editorState: EditorState): string {
  const contentState = editorState.getCurrentContent();
  const rawContent = convertToRaw(contentState);
  
  return rawContentToMarkdown(rawContent);
}

/**
 * Convert raw Draft.js content to Markdown
 */
export function rawContentToMarkdown(rawContent: RawDraftContentState): string {
  const blocks = rawContent.blocks;
  const entityMap = rawContent.entityMap;
  
  return blocks.map(block => {
    let text = block.text;
    const inlineStyles = block.inlineStyleRanges;
    const entityRanges = block.entityRanges;
    
    // Sort ranges by offset in reverse order to avoid index shifting
    const allRanges = [
      ...inlineStyles.map(range => ({ ...range, type: 'style' })),
      ...entityRanges.map(range => ({ ...range, type: 'entity' }))
    ].sort((a, b) => b.offset - a.offset);
    
    // Apply formatting from right to left
    for (const range of allRanges) {
      const start = range.offset;
      const end = range.offset + range.length;
      const selectedText = text.slice(start, end);
      
      if (range.type === 'style') {
        const styleRange = range as RawDraftInlineStyleRange;
        let formattedText = selectedText;
        
        switch (styleRange.style) {
          case 'BOLD':
            formattedText = `**${selectedText}**`;
            break;
          case 'ITALIC':
            formattedText = `*${selectedText}*`;
            break;
          case 'CODE':
            formattedText = `\`${selectedText}\``;
            break;
          case 'UNDERLINE':
            // Markdown doesn't have native underline, use HTML
            formattedText = `<u>${selectedText}</u>`;
            break;
        }
        
        text = text.slice(0, start) + formattedText + text.slice(end);
      } else if (range.type === 'entity') {
        const entityRange = range as RawDraftEntityRange;
        const entity = entityMap[entityRange.key];
        
        if (entity && entity.type === 'LINK') {
          const url = entity.data.url || entity.data.href;
          const formattedText = `[${selectedText}](${url})`;
          text = text.slice(0, start) + formattedText + text.slice(end);
        }
      }
    }
    
    // Handle block types
    switch (block.type) {
      case 'header-one':
        return `# ${text}`;
      case 'header-two':
        return `## ${text}`;
      case 'header-three':
        return `### ${text}`;
      case 'header-four':
        return `#### ${text}`;
      case 'header-five':
        return `##### ${text}`;
      case 'header-six':
        return `###### ${text}`;
      case 'blockquote':
        return `> ${text}`;
      case 'code-block':
        return `\`\`\`\n${text}\n\`\`\``;
      case 'unordered-list-item':
        return `- ${text}`;
      case 'ordered-list-item':
        return `1. ${text}`;
      default:
        return text;
    }
  }).join('\n\n');
}

/**
 * Convert Markdown to Draft.js EditorState
 */
export function markdownToDraft(markdown: string): EditorState {
  const rawContent = markdownToRawContent(markdown);
  const contentState = convertFromRaw(rawContent);
  return EditorState.createWithContent(contentState);
}

/**
 * Convert Markdown to raw Draft.js content
 */
export function markdownToRawContent(markdown: string): RawDraftContentState {
  const lines = markdown.split('\n');
  const blocks: RawDraftContentState['blocks'] = [];
  const entityMap: RawDraftContentState['entityMap'] = {};
  let entityKey = 0;
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }
    
    // Handle code blocks
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++; // Skip opening ```
      
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      
      if (i < lines.length) {
        i++; // Skip closing ```
      }
      
      blocks.push({
        key: generateBlockKey(),
        type: 'code-block',
        text: codeLines.join('\n'),
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: {}
      });
      
      continue;
    }
    
    // Parse the line for block type and inline formatting
    const blockResult = parseMarkdownLine(line, entityMap, entityKey);
    blocks.push(blockResult.block);
    entityKey = blockResult.nextEntityKey;
    
    i++;
  }
  
  // Add a default block if no blocks were created
  if (blocks.length === 0) {
    blocks.push({
      key: generateBlockKey(),
      type: 'unstyled',
      text: '',
      depth: 0,
      inlineStyleRanges: [],
      entityRanges: [],
      data: {}
    });
  }
  
  return {
    blocks,
    entityMap
  };
}

/**
 * Parse a single Markdown line into a Draft.js block
 */
function parseMarkdownLine(
  line: string, 
  entityMap: RawDraftContentState['entityMap'], 
  startEntityKey: number
): { block: RawDraftContentState['blocks'][0], nextEntityKey: number } {
  let text = line;
  let blockType = 'unstyled';
  let entityKey = startEntityKey;
  
  // Determine block type
  if (text.startsWith('# ')) {
    blockType = 'header-one';
    text = text.slice(2);
  } else if (text.startsWith('## ')) {
    blockType = 'header-two';
    text = text.slice(3);
  } else if (text.startsWith('### ')) {
    blockType = 'header-three';
    text = text.slice(4);
  } else if (text.startsWith('#### ')) {
    blockType = 'header-four';
    text = text.slice(5);
  } else if (text.startsWith('##### ')) {
    blockType = 'header-five';
    text = text.slice(6);
  } else if (text.startsWith('###### ')) {
    blockType = 'header-six';
    text = text.slice(7);
  } else if (text.startsWith('> ')) {
    blockType = 'blockquote';
    text = text.slice(2);
  } else if (text.startsWith('- ') || text.startsWith('* ')) {
    blockType = 'unordered-list-item';
    text = text.slice(2);
  } else if (/^\d+\.\s/.test(text)) {
    blockType = 'ordered-list-item';
    text = text.replace(/^\d+\.\s/, '');
  }
  
  // Parse inline formatting
  const inlineStyles: RawDraftInlineStyleRange[] = [];
  const entityRanges: RawDraftEntityRange[] = [];
  
  // Parse links [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch;
  let offset = 0;
  
  while ((linkMatch = linkRegex.exec(text)) !== null) {
    const linkText = linkMatch[1];
    const url = linkMatch[2];
    const matchStart = linkMatch.index - offset;
    
    // Add entity to map
    entityMap[entityKey] = {
      type: 'LINK',
      mutability: 'MUTABLE',
      data: { url }
    };
    
    // Add entity range
    entityRanges.push({
      offset: matchStart,
      length: linkText.length,
      key: entityKey
    });
    
    // Replace the markdown link with just the text
    text = text.slice(0, linkMatch.index - offset) + linkText + text.slice(linkMatch.index - offset + linkMatch[0].length);
    offset += linkMatch[0].length - linkText.length;
    entityKey++;
  }
  
  // Parse bold **text**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let boldMatch;
  offset = 0;
  
  while ((boldMatch = boldRegex.exec(text)) !== null) {
    const boldText = boldMatch[1];
    const matchStart = boldMatch.index - offset;
    
    inlineStyles.push({
      offset: matchStart,
      length: boldText.length,
      style: 'BOLD'
    });
    
    text = text.slice(0, boldMatch.index - offset) + boldText + text.slice(boldMatch.index - offset + boldMatch[0].length);
    offset += boldMatch[0].length - boldText.length;
  }
  
  // Parse italic *text*
  const italicRegex = /\*([^*]+)\*/g;
  let italicMatch;
  offset = 0;
  
  while ((italicMatch = italicRegex.exec(text)) !== null) {
    const italicText = italicMatch[1];
    const matchStart = italicMatch.index - offset;
    
    inlineStyles.push({
      offset: matchStart,
      length: italicText.length,
      style: 'ITALIC'
    });
    
    text = text.slice(0, italicMatch.index - offset) + italicText + text.slice(italicMatch.index - offset + italicMatch[0].length);
    offset += italicMatch[0].length - italicText.length;
  }
  
  // Parse code `text`
  const codeRegex = /`([^`]+)`/g;
  let codeMatch;
  offset = 0;
  
  while ((codeMatch = codeRegex.exec(text)) !== null) {
    const codeText = codeMatch[1];
    const matchStart = codeMatch.index - offset;
    
    inlineStyles.push({
      offset: matchStart,
      length: codeText.length,
      style: 'CODE'
    });
    
    text = text.slice(0, codeMatch.index - offset) + codeText + text.slice(codeMatch.index - offset + codeMatch[0].length);
    offset += codeMatch[0].length - codeText.length;
  }
  
  return {
    block: {
      key: generateBlockKey(),
      type: blockType,
      text,
      depth: 0,
      inlineStyleRanges: inlineStyles,
      entityRanges,
      data: {}
    },
    nextEntityKey: entityKey
  };
}

/**
 * Generate a unique block key
 */
function generateBlockKey(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Check if content is likely Markdown
 */
export function isMarkdown(content: string): boolean {
  const markdownPatterns = [
    /^#{1,6}\s/, // Headers
    /^\*\*.*\*\*/, // Bold
    /^\*.*\*/, // Italic
    /^`.*`/, // Inline code
    /^```/, // Code blocks
    /^\[.*\]\(.*\)/, // Links
    /^>\s/, // Blockquotes
    /^[-*+]\s/, // Unordered lists
    /^\d+\.\s/ // Ordered lists
  ];
  
  const lines = content.split('\n');
  let markdownLineCount = 0;
  
  for (const line of lines) {
    if (markdownPatterns.some(pattern => pattern.test(line.trim()))) {
      markdownLineCount++;
    }
  }
  
  // Consider it markdown if more than 20% of lines have markdown syntax
  return markdownLineCount / lines.length > 0.2;
}