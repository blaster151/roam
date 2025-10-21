/**
 * Core data models for the Web Note App
 * Based on requirements 2.5, 3.1, 5.4
 */

/**
 * Represents a note in the application with rich text content and relationships
 */
export interface Note {
  /** Unique identifier for the note */
  id: string;
  
  /** Display title of the note */
  title: string;
  
  /** Rich text content stored as serialized editor state */
  content: string;
  
  /** Timestamp when the note was created */
  createdAt: Date;
  
  /** Timestamp when the note was last updated */
  updatedAt: Date;
  
  /** ID of parent note for hierarchical organization (optional) */
  parentId?: string;
  
  /** Order position within the same level for sorting */
  order: number;
  
  /** Bi-directional link relationships */
  links: {
    /** IDs of notes this note links to */
    outbound: string[];
    /** IDs of notes that link to this note */
    inbound: string[];
  };
  
  /** Smart embeds contained in this note */
  embeds: LinkEmbed[];
}

/**
 * Represents a smart web link embed with metadata
 */
export interface LinkEmbed {
  /** Unique identifier for the embed */
  id: string;
  
  /** Original URL being embedded */
  url: string;
  
  /** Page title extracted from metadata */
  title?: string;
  
  /** Page description extracted from metadata */
  description?: string;
  
  /** Representative image URL */
  image?: string;
  
  /** Site favicon URL */
  favicon?: string;
  
  /** Site name extracted from metadata */
  siteName?: string;
  
  /** Timestamp when embed was created */
  createdAt: Date;
}

/**
 * Represents a search result with highlighted matches
 */
export interface SearchResult {
  /** ID of the note containing the match */
  noteId: string;
  
  /** Title of the matching note */
  title: string;
  
  /** Context snippet showing the match */
  snippet: string;
  
  /** Search relevance score */
  score: number;
  
  /** Positions of matching text for highlighting */
  matches: SearchMatch[];
}

/**
 * Represents a text match within search results
 */
export interface SearchMatch {
  /** Start position of the match in the content */
  start: number;
  
  /** End position of the match in the content */
  end: number;
  
  /** The matched text */
  text: string;
}