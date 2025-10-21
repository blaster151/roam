# Implementation Plan

- [x] 1. Set up project structure and core dependencies

  - Initialize React TypeScript project with Vite for fast development
  - Install core dependencies: Zustand, Dexie.js, Draft.js, React DnD, Fuse.js
  - Configure TypeScript with strict mode and path aliases
  - Set up CSS Modules configuration
  - _Requirements: 7.1, 7.4_

- [x] 2. Implement core data models and storage foundation


  - [x] 2.1 Create TypeScript interfaces for Note, LinkEmbed, and SearchResult models

    - Define Note interface with id, title, content, timestamps, parentId, order, and links
    - Define LinkEmbed interface for smart web link previews
    - Define SearchResult interface for search functionality
    - _Requirements: 2.5, 3.1, 5.4_

  - [x] 2.2 Implement abstract storage service interface

    - Create IStorageService interface for future migration flexibility
    - Define CRUD operations and query methods
    - Include transaction support and error handling patterns
    - _Requirements: 6.3, 7.2_

  - [x] 2.3 Implement IndexedDB storage service with Dexie.js

    - Set up database schema with notes, embeds, and metadata tables
    - Implement CRUD operations for notes with proper indexing
    - Add transaction support and error handling
    - _Requirements: 6.3, 7.2_

- [ ] 3. Create basic note management system

  - [ ] 3.1 Implement Zustand store for application state

    - Create stores for notes, selected note, sidebar state, search, UI state, and theme
    - Implement actions for note CRUD operations
    - Add state persistence and hydration
    - Include first-time user detection and welcome screen state
    - Add theme state management with persistence
    - _Requirements: 6.1, 6.4, 8.4, 8.5_

  - [ ] 3.2 Build Note service with business logic

    - Implement note creation, updating, and deletion
    - Add hierarchical relationship management (parent-child with 2-level limit)
    - Implement note ordering and reordering logic
    - _Requirements: 4.4, 6.1_

  - [ ] 3.3 Create welcome screen for first-time users

    - Build welcome screen component with app introduction and key features
    - Implement first-time user detection using local storage
    - Add dismissible welcome screen that reveals main interface
    - Create smooth transition from welcome screen to main app
    - _Requirements: 7.1, 7.5_

  - [ ] 3.4 Create basic App component with routing and keyboard shortcuts
    - Set up main application layout with sidebar and editor areas
    - Implement global keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K)
    - Add basic navigation between notes
    - Integrate welcome screen conditional rendering
    - _Requirements: 1.4, 1.5, 1.6_

- [ ] 4. Build rich text editor with formatting capabilities

  - [ ] 4.1 Implement Draft.js editor component

    - Set up Draft.js editor with TypeScript integration
    - Configure rich text plugins for bold, italic, and basic formatting
    - Implement real-time rendering of formatted content
    - _Requirements: 1.1, 1.2, 1.9_

  - [ ] 4.2 Add Markdown support and content preservation

    - Implement Markdown parsing and rendering
    - Add paste handling that preserves rich formatting
    - Create conversion utilities between Draft.js and Markdown
    - _Requirements: 1.1, 1.3_

  - [ ] 4.3 Implement image paste functionality

    - Add image paste detection and handling
    - Implement image storage in IndexedDB as base64 or blob
    - Create image rendering component within editor
    - _Requirements: 1.7_

  - [ ] 4.4 Add keyboard shortcut handlers for text formatting
    - Implement Ctrl+B for bold formatting on selected text
    - Implement Ctrl+I for italic formatting on selected text
    - Implement Ctrl+K for link creation with clipboard URL detection
    - _Requirements: 1.4, 1.5, 1.6_

- [ ] 5. Implement autosave functionality

  - [ ] 5.1 Create debounced autosave system
    - Implement 2-second debounced saving after user stops typing
    - Add visual indicators for save status (saving, saved, error)
    - Create recovery mechanism for unsaved changes on app restart
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

- [ ] 6. Build sidebar with hierarchical note organization

  - [ ] 6.1 Create basic sidebar component with note list

    - Display all notes in hierarchical tree structure
    - Implement note selection and active state highlighting
    - Add visual indicators for parent-child relationships
    - _Requirements: 4.1, 4.4_

  - [ ] 6.2 Implement drag-and-drop functionality with React DnD

    - Add drag-and-drop for note reordering within same level
    - Implement drop-onto-note functionality for creating parent-child relationships
    - Enforce 2-level nesting limit with visual feedback
    - Add visual feedback during drag operations
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.3 Add collapsible parent notes and visual hierarchy
    - Implement expand/collapse functionality for parent notes
    - Add indentation and visual cues for nested structure
    - Persist expand/collapse state in local storage
    - _Requirements: 4.1, 4.4_

- [ ] 7. Implement bi-directional linking system

  - [ ] 7.1 Create Link service for relationship management

    - Implement bi-directional link creation and maintenance
    - Add link integrity validation when notes are renamed or deleted
    - Create backlink computation and storage
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ] 7.2 Add link creation UI and note reference detection

    - Implement link creation through note title references in editor
    - Add autocomplete for existing note titles during link creation
    - Create clickable navigation between linked notes
    - _Requirements: 2.3, 2.4_

  - [ ] 7.3 Build backlinks display component
    - Create component to display which notes reference the current note
    - Add clickable navigation to referencing notes
    - Integrate backlinks display into note editor view
    - _Requirements: 2.2, 2.3_

- [ ] 8. Implement smart embed system for web links

  - [ ] 8.1 Create Embed service for URL metadata extraction

    - Implement URL detection in note content
    - Create metadata extraction using Open Graph and Twitter Card protocols
    - Add caching system for embed data to avoid repeated requests
    - Handle CORS restrictions with fallback strategies
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ] 8.2 Build Smart Embed component

    - Create compact embed display component (3-line height maximum)
    - Display title, description, image, and favicon when available
    - Make embeds clickable to open original URLs
    - Add loading states and error handling for failed embeds
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 8.3 Integrate embeds into editor workflow
    - Add automatic embed generation when URLs are pasted
    - Implement embed replacement and editing capabilities
    - Store embed metadata in note data structure
    - _Requirements: 3.1, 3.5_

- [ ] 9. Build search functionality

  - [ ] 9.1 Implement Search service with Fuse.js

    - Set up full-text search indexing for all note content
    - Configure fuzzy search with appropriate scoring
    - Implement search result ranking and relevance
    - _Requirements: 5.2, 5.4_

  - [ ] 9.2 Create search UI component

    - Build search input with real-time results
    - Display search results with note titles and context snippets
    - Implement search term highlighting in results
    - Add navigation to full notes from search results
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [ ] 9.3 Integrate search with main application
    - Add search accessibility from main interface
    - Implement keyboard shortcuts for search activation
    - Connect search results to note navigation system
    - _Requirements: 5.1, 5.5_

- [ ] 10. Add error handling and recovery systems

  - [ ] 10.1 Implement storage error handling

    - Add graceful degradation when IndexedDB is unavailable
    - Create fallback to localStorage with reduced functionality
    - Implement user notifications for storage quota exceeded
    - _Requirements: 6.3, 7.2_

  - [ ] 10.2 Add editor error recovery

    - Implement undo/redo functionality for accidental changes
    - Create content recovery from autosave data
    - Add validation for malformed content and graceful handling
    - _Requirements: 6.5, 1.9_

  - [ ] 10.3 Handle drag-and-drop edge cases
    - Prevent invalid nesting beyond 2 levels with user feedback
    - Implement rollback for failed drag operations
    - Add visual feedback for invalid drop targets
    - _Requirements: 4.4, 4.5_

- [ ] 11. Implement dark mode theme system

  - [ ] 11.1 Create Theme service and CSS custom properties

    - Implement Theme service for dark/light mode management
    - Set up CSS custom properties for theme colors
    - Add system theme preference detection
    - Create smooth theme transition animations
    - _Requirements: 8.1, 8.3, 8.4, 8.5_

  - [ ] 11.2 Build theme toggle component

    - Create theme toggle button/switch component
    - Implement immediate theme switching across all interface elements
    - Add visual feedback for current theme state
    - Integrate theme toggle into main application header
    - _Requirements: 8.2, 8.3_

  - [ ] 11.3 Apply dark mode styling to all components
    - Update all components to use CSS custom properties for theming
    - Ensure proper contrast ratios in both light and dark modes
    - Test theme consistency across editor, sidebar, search, and embeds
    - Verify accessibility compliance for both themes
    - _Requirements: 8.1, 8.3_

- [ ] 12. Implement responsive design and accessibility

  - [ ] 12.1 Create responsive layout with CSS Grid/Flexbox

    - Implement responsive sidebar that collapses on mobile
    - Ensure editor remains usable across different screen sizes
    - Add touch-friendly interactions for mobile devices
    - _Requirements: 7.5_

  - [ ] 12.2 Add accessibility features
    - Implement full keyboard navigation for all features
    - Add ARIA labels and screen reader compatibility
    - Ensure high contrast mode support and color-blind friendly design
    - _Requirements: 7.5_

- [ ] 13. Performance optimization and final integration

  - [ ] 13.1 Implement performance optimizations

    - Add virtual scrolling for large note lists in sidebar
    - Implement lazy loading of note content
    - Optimize bundle size with code splitting
    - _Requirements: 7.5_

  - [ ] 13.2 Final integration and testing

    - Connect all components into cohesive application
    - Implement comprehensive error boundaries
    - Add loading states and user feedback throughout the application
    - Verify all requirements are met through manual testing
    - _Requirements: 1.1-8.5_

  - [ ] 13.3 Write comprehensive test suite
    - Create unit tests for all service layer components
    - Add integration tests for editor and storage interactions
    - Implement end-to-end tests for complete user workflows
    - Add performance tests for large datasets
    - Include theme switching tests for both light and dark modes
    - _Requirements: All_
