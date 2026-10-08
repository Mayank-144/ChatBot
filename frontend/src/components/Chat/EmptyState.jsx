export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-icon-badge">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h2>What would you like to explore today?</h2>
        <p>Ask real-time questions, run math through MCP tools, explore Wikipedia, check live weather, or upload documents and images.</p>
        <div className="quick-features-row">
          <span className="feature-pill">🌤️ Live Weather Lookup</span>
          <span className="feature-pill">📚 Wikipedia Knowledge</span>
          <span className="feature-pill">🧮 MCP Calculator</span>
          <span className="feature-pill">🕒 Real-Time Clock</span>
          <span className="feature-pill">🖼️ Vision & Image QA</span>
          <span className="feature-pill">📄 PDF, Excel & Docs</span>
        </div>
      </div>
    </div>
  );
}
