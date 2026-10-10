import React from 'react';
import { CloseIcon, Spinner } from '../Icons/Icons';

export function DocumentBadgeList({
  ragDocuments = [],
  isUploadingRAG = false,
  ragStatusMessage = '',
  ragError = null,
  onDeleteDocument,
}) {
  if (ragDocuments.length === 0 && !isUploadingRAG && !ragError) {
    return null;
  }

  const getDocIcon = (fileType) => {
    const type = (fileType || '').toLowerCase();
    if (type.includes('pdf')) {
      return (
        <span className="rag-doc-icon pdf" title="PDF Document">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </span>
      );
    }
    if (type.includes('xls') || type.includes('csv') || type.includes('sheet')) {
      return (
        <span className="rag-doc-icon excel" title="Spreadsheet">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <rect x="8" y="12" width="8" height="6" rx="1" />
          </svg>
        </span>
      );
    }
    return (
      <span className="rag-doc-icon default" title="Document">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </span>
    );
  };

  return (
    <div className="rag-knowledge-container">
      <div className="rag-knowledge-header">
        <div className="rag-knowledge-title">
          <span className="rag-pulse-dot" />
          <span>Active RAG Knowledge Base ({ragDocuments.length})</span>
        </div>
        {ragStatusMessage && (
          <span className="rag-status-msg">{ragStatusMessage}</span>
        )}
      </div>

      {ragError && (
        <div className="rag-error-banner">
          ⚠️ {ragError}
        </div>
      )}

      <div className="rag-chips-scroll">
        {isUploadingRAG && (
          <div className="rag-chip uploading">
            <Spinner />
            <span className="rag-chip-name">Indexing document with Cohere...</span>
          </div>
        )}

        {ragDocuments.map((doc) => (
          <div key={doc.documentId} className="rag-chip" title={`${doc.fileName} (${doc.totalChunks} chunks)`}>
            {getDocIcon(doc.fileType)}
            <span className="rag-chip-name">{doc.fileName}</span>
            <span className="rag-chip-count">{doc.totalChunks} chunks</span>
            {onDeleteDocument && (
              <button
                type="button"
                className="rag-chip-remove"
                onClick={() => onDeleteDocument(doc.documentId)}
                title="Remove from Vector Knowledge Base"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentBadgeList;
