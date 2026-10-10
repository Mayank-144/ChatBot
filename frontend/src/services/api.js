const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/api/chat';

/**
 * Send chat messages to custom backend API and receive streaming response
 * @param {Array} messages - Array of message objects { role, content }
 * @param {Function} onChunk - Callback when new text chunk is received
 * @param {Function} onDone - Callback when streaming is finished
 * @param {Function} onError - Callback when an error occurs
 * @param {AbortSignal} signal - Optional abort signal to cancel request
 */
export async function sendChatMessage({ messages, onChunk, onToolsUsed, onDone, onError, signal }) {
  try {
    // If the current request contains images, restrict chat context to the last 4 messages
    // to strictly prevent exceeding Groq's 7000 input tokens per minute (ITPM) rate limit.
    const lastMsg = messages[messages.length - 1];
    const hasCurrentImages = lastMsg && Array.isArray(lastMsg.images) && lastMsg.images.length > 0;
    const windowedMessages = hasCurrentImages ? messages.slice(-4) : messages.slice(-12);

    const formattedPayload = windowedMessages.map((m, idx, arr) => {
      const isLatest = idx === arr.length - 1; // Only attach image base64 for the latest message
      return {
        role: m.role,
        content: m.apiPayload || m.content || '',
        images: isLatest && Array.isArray(m.images) ? m.images.slice(0, 2) : [],
      };
    });

    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: formattedPayload,
      }),
      signal,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const serverErrMsg = errData?.error?.message || `Server responded with status ${response.status}`;
      throw new Error(serverErrMsg);
    }

    if (response.body && response.body.getReader) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.toolsUsed && onToolsUsed) {
                onToolsUsed(parsed.toolsUsed);
              }
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta && onChunk) {
                onChunk(delta);
              }
            } catch (e) {
              // Partial JSON chunk
            }
          }
        }
      }

      if (buffer && buffer.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.slice(6));
          if (parsed.toolsUsed && onToolsUsed) {
            onToolsUsed(parsed.toolsUsed);
          }
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta && onChunk) {
            onChunk(delta);
          }
        } catch { }
      }

      if (onDone) onDone();
    } else {
      const data = await response.json();
      if (data.toolsUsed && onToolsUsed) {
        onToolsUsed(data.toolsUsed);
      }
      const fullContent = data.choices?.[0]?.message?.content || '';
      if (onChunk) onChunk(fullContent);
      if (onDone) onDone();
    }
  } catch (error) {
    console.error('API Service Error:', error);
    if (onError) onError(error);
  }
}

/**
 * Upload a document (PDF/Excel) to the backend RAG pipeline
 * @param {File} file 
 * @param {string} [sessionId='default']
 * @returns {Promise<Object>}
 */
export async function uploadDocumentToRAG(file, sessionId = 'default') {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sessionId', sessionId);

  const response = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `Failed to upload document (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch all documents indexed in the vector database
 * @param {string} [sessionId]
 * @returns {Promise<Array>}
 */
export async function fetchRAGDocuments(sessionId) {
  const url = sessionId ? `/api/documents?sessionId=${encodeURIComponent(sessionId)}` : '/api/documents';
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch indexed documents');
  }
  const data = await response.json();
  return data.documents || [];
}

/**
 * Delete a document from the vector store
 * @param {string} documentId 
 * @returns {Promise<Object>}
 */
export async function deleteRAGDocument(documentId) {
  const response = await fetch(`/api/documents/${documentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete document from vector database');
  }
  return response.json();
}

/**
 * Directly search document vector index (optional utility)
 * @param {string} query 
 * @param {string} [sessionId]
 * @returns {Promise<Array>}
 */
export async function searchRAGDocuments(query, sessionId) {
  const response = await fetch('/api/documents/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, sessionId }),
  });
  if (!response.ok) {
    throw new Error('Vector search failed');
  }
  const data = await response.json();
  return data.results || [];
}
