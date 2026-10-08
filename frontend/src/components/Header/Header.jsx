import { SunIcon, MoonIcon, TrashIcon } from '../Icons/Icons';

export function Header({ theme, onToggleTheme, onClearChat }) {
  return (
    <header className="chat-header">
      <div className="header-left">
        <span className="bot-title">Mayank</span>
        <span className="separator">/</span>
        <span className="status-indicator">
          <span className="status-dot"></span> Online
        </span>
      </div>

      <div className="header-actions">
        {/* Theme Toggle Button */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title="Toggle theme"
        >
          <span className={`toggle-icon ${theme === 'light' ? 'active' : ''}`}>
            <SunIcon />
          </span>
          <span className={`toggle-icon ${theme === 'dark' ? 'active' : ''}`}>
            <MoonIcon />
          </span>
        </button>

        {/* Clear Conversation Button */}
        <button
          type="button"
          id="clear-chat-btn"
          className="header-btn"
          onClick={onClearChat}
          title="Clear conversation"
        >
          <TrashIcon />
          <span>Clear</span>
        </button>
      </div>
    </header>
  );
}
