export function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <div className="empty-icon-badge">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h2>What can I help you analyze today?</h2>
        <p>Upload documents (PDF, Excel, Word, CSV) or type your message below to get started.</p>
        <div className="quick-features-row">
          <span className="feature-pill">📄 PDF Analysis</span>
          <span className="feature-pill">📊 Excel & CSV Insights</span>
          <span className="feature-pill">📝 Word & Text Summaries</span>
        </div>
      </div>
    </div>
  );
}
