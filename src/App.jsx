import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './App.css';

// SVG Icons
const CopyIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const CheckIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
  </svg>
);

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('chat_theme') || 'dark');
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Persist theme
  useEffect(() => {
    localStorage.setItem('chat_theme', theme);
  }, [theme]);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleClearChat = () => {
    if (window.confirm('Clear conversation?')) {
      setMessages([]);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;

    const time = getCurrentTime();
    const userMessage = { role: 'user', content: input.trim(), time };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      const apiUrl = import.meta.env.VITE_API_URL || 'https://api.groq.com/openai/v1/chat/completions';
      const model = import.meta.env.VITE_MODEL || 'openai/gpt-oss-120b';

      const headers = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: model,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const assistantMessage = {
        role: 'assistant',
        content: content,
        time: getCurrentTime(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Something went wrong: ${error.message}`,
          time: getCurrentTime(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`app-wrapper ${theme}`}>
      <div className="chat-window">
        {/* Top Header */}
        <header className="chat-header">
          <div className="header-left">
            <span className="bot-title">AI</span>
            <span className="separator">/</span>
            <span className="status-indicator">
              <span className="status-dot"></span> Online
            </span>
          </div>

          <div className="header-actions">
            {/* Theme Toggle Button */}
            <button className="theme-toggle-btn" onClick={handleToggleTheme} title="Toggle theme">
              <span className={`toggle-icon ${theme === 'light' ? 'active' : ''}`}>
                <SunIcon />
              </span>
              <span className={`toggle-icon ${theme === 'dark' ? 'active' : ''}`}>
                <MoonIcon />
              </span>
            </button>

            <button className="header-btn" onClick={handleClearChat} title="Clear conversation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Clear</span>
            </button>
          </div>
        </header>

        {/* Messages Body */}
        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>Type your message below to start chatting...</p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div key={index} className={`message-item ${msg.role}`}>
              <div className="message-meta">
                <span className={`sender-name ${msg.role}`}>
                  {msg.role === 'user' ? 'User' : '🤖 AI'}
                </span>
                <span className="message-time">{msg.time || 'now'}</span>
              </div>

              <div className="message-body">
                {msg.role === 'assistant' ? (
                  <div className="markdown-render">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="user-text">{msg.content}</p>
                )}
              </div>

              {/* Copy Icon Button (both User and Assistant) */}
              <div className="message-actions">
                <button
                  className="copy-icon-btn"
                  onClick={() => handleCopy(msg.content, index)}
                  title={copiedIndex === index ? 'Copied!' : 'Copy message'}
                >
                  {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-item assistant loading-item">
              <div className="message-meta">
                <span className="sender-name assistant">🤖 AI</span>
                <span className="message-time">typing...</span>
              </div>
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="input-section">
          <div className="input-box-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message ..."
              disabled={loading}
              spellCheck="false"
              autoComplete="off"
              autoCorrect="off"
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              Send ↵
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
