const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/api/chat';

/**
 * Send chat messages to custom backend API and receive streaming response
 * @param {Object} options
 * @param {Array} options.messages - Array of message objects { role, content }
 * @param {string} [options.sessionId='default'] - Unique session ID for conversation memory
 * @param {Function} [options.onChunk] - Callback when new text chunk is received
 * @param {Function} [options.onToolsUsed] - Callback when tool badges array is updated
 * @param {Function} [options.onTodos] - Callback when live todo planning list is updated
 * @param {Function} [options.onSubagent] - Callback when subagent starts or completes
 * @param {Function} [options.onAgentRoute] - Callback when query router identifies agent type
 * @param {Function} [options.onDone] - Callback when streaming is finished
 * @param {Function} [options.onError] - Callback when an error occurs
 * @param {AbortSignal} [options.signal] - Optional abort signal to cancel request
 */
export async function sendChatMessage({
  messages,
  sessionId = 'default',
  onChunk,
  onToolsUsed,
  onTodos,
  onSubagent,
  onAgentRoute,
  onApprovalRequest,
  onDone,
  onError,
  signal,
}) {
  try {
    // If the current request contains images, restrict chat context to the last 4 messages
    // to strictly prevent exceeding Groq's input token limits.
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
        'X-Session-ID': sessionId,
      },
      body: JSON.stringify({
        messages: formattedPayload,
        sessionId,
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

      const handleParsedEvent = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return;

        if (parsed.agentRoute && onAgentRoute) {
          onAgentRoute(parsed.agentRoute, parsed.reason);
        }

        if (parsed.toolsUsed && onToolsUsed) {
          onToolsUsed(parsed.toolsUsed);
        }

        if (parsed.todos && onTodos) {
          onTodos(parsed.todos);
        }

        if (parsed.subagent && onSubagent) {
          onSubagent({
            name: parsed.subagent,
            status: parsed.status,
            task: parsed.task,
          });
        }

        if (parsed.approvalRequest && onApprovalRequest) {
          onApprovalRequest(parsed.approvalRequest);
        }

        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta && onChunk) {
          onChunk(delta);
        }
      };

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
              handleParsedEvent(parsed);
            } catch (e) {
              // Partial JSON chunk
            }
          }
        }
      }

      if (buffer && buffer.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(buffer.slice(6));
          handleParsedEvent(parsed);
        } catch { }
      }

      if (onDone) onDone();
    } else {
      const data = await response.json();
      if (data.agentRoute && onAgentRoute) {
        onAgentRoute(data.agentRoute, data.reason);
      }
      if (data.toolsUsed && onToolsUsed) {
        onToolsUsed(data.toolsUsed);
      }
      if (data.todos && onTodos) {
        onTodos(data.todos);
      }
      if (data.subagent && onSubagent) {
        onSubagent({
          name: data.subagent,
          status: data.status,
          task: data.task,
        });
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
 * Submit user approval or rejection decision to backend
 * @param {Object} params
 * @param {string} params.approvalId - The approval request ID
 * @param {string} params.sessionId - Active session ID
 * @param {'approve' | 'reject'} params.decision - Human decision
 * @returns {Promise<Object>}
 */
export async function submitApprovalDecision({ approvalId, sessionId = 'default', decision }) {
  const response = await fetch('/api/approval', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': sessionId,
    },
    body: JSON.stringify({
      approvalId,
      sessionId,
      decision,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit approval decision');
  }

  return response.json();
}

