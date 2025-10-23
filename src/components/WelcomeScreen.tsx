/**
 * Welcome screen component for first-time users
 * Based on requirements 7.1, 7.5
 */

import React from 'react';
import { useUIStore } from '../stores';
import './WelcomeScreen.css';

export const WelcomeScreen: React.FC = () => {
  const { dismissWelcomeScreen } = useUIStore();

  const handleGetStarted = () => {
    dismissWelcomeScreen();
  };

  const features = [
    {
      icon: '📝',
      title: 'Rich Text Editing',
      description: 'Create notes with Markdown support and rich formatting. Paste images directly into your notes.'
    },
    {
      icon: '🔗',
      title: 'Bi-directional Links',
      description: 'Connect your thoughts with bi-directional links between notes. See backlinks automatically.'
    },
    {
      icon: '🌐',
      title: 'Smart Web Embeds',
      description: 'Paste web URLs to get beautiful previews with titles, descriptions, and images.'
    },
    {
      icon: '📁',
      title: 'Hierarchical Organization',
      description: 'Organize notes in a sidebar with drag-and-drop. Create parent-child relationships up to 2 levels.'
    },
    {
      icon: '🔍',
      title: 'Powerful Search',
      description: 'Find any note instantly with full-text search across all your content.'
    },
    {
      icon: '💾',
      title: 'Auto-save Everything',
      description: 'Never lose your work. All changes are automatically saved locally in your browser.'
    },
    {
      icon: '🌙',
      title: 'Dark Mode',
      description: 'Switch between light and dark themes for comfortable writing in any lighting.'
    },
    {
      icon: '⚡',
      title: 'Works Offline',
      description: 'No internet required after loading. All your data stays private on your device.'
    }
  ];

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-header">
          <h1 className="welcome-title">
            Welcome to <span className="app-name">Web Note App</span>
          </h1>
          <p className="welcome-subtitle">
            Your personal knowledge management system that works entirely in your browser
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="welcome-actions">
          <button 
            className="get-started-button"
            onClick={handleGetStarted}
          >
            Get Started
          </button>
          <p className="privacy-note">
            🔒 All your data stays on your device. No accounts, no tracking, no servers.
          </p>
        </div>

        <div className="keyboard-shortcuts">
          <h3>Quick Keyboard Shortcuts</h3>
          <div className="shortcuts-grid">
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>B</kbd>
              <span>Bold text</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>I</kbd>
              <span>Italic text</span>
            </div>
            <div className="shortcut">
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
              <span>Create link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};