import { useState, useEffect, useCallback } from 'react';
import { uploadDocumentToRAG, fetchRAGDocuments, deleteRAGDocument } from '../services/api';

export function useRAG() {
  const [ragDocuments, setRagDocuments] = useState([]);
  const [isUploadingRAG, setIsUploadingRAG] = useState(false);
  const [ragStatusMessage, setRagStatusMessage] = useState('');
  const [ragError, setRagError] = useState(null);

  // Load indexed documents from MongoDB on mount
  const loadDocuments = useCallback(async () => {
    try {
      const docs = await fetchRAGDocuments();
      setRagDocuments(docs);
      setRagError(null);
    } catch (err) {
      console.warn('Failed to load RAG documents:', err.message);
      // Non-fatal, vector db might not be configured yet
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Upload and index a PDF or Excel document
  const uploadToRAG = async (file) => {
    setIsUploadingRAG(true);
    setRagError(null);
    setRagStatusMessage(`Embedding "${file.name}" with Cohere multilingual-v3...`);

    try {
      const res = await uploadDocumentToRAG(file);
      setRagStatusMessage(`Indexed ${res.document?.totalChunks || 'all'} chunks into MongoDB Atlas!`);
      await loadDocuments();
      setTimeout(() => setRagStatusMessage(''), 3000);
      return res.document;
    } catch (err) {
      console.error('RAG upload failed:', err.message);
      setRagError(err.message);
      setRagStatusMessage('');
      throw err;
    } finally {
      setIsUploadingRAG(false);
    }
  };

  // Delete a document from vector DB
  const deleteFromRAG = async (documentId) => {
    try {
      await deleteRAGDocument(documentId);
      setRagDocuments((prev) => prev.filter((d) => d.documentId !== documentId));
    } catch (err) {
      console.error('Failed to delete document:', err.message);
      setRagError(err.message);
    }
  };

  return {
    ragDocuments,
    isUploadingRAG,
    ragStatusMessage,
    ragError,
    loadDocuments,
    uploadToRAG,
    deleteFromRAG,
  };
}
