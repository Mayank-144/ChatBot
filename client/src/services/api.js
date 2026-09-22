const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL || '/api/chat';

/**
 * Send chat messages to custom backend API and receive streaming response
 * @param {Array} messages - Array of message objects { role, content }
 * @param {Function} onChunk - Callback when new text chunk is received
 * @param {Function} onDone - Callback when streaming is finished
 * @param {Function} onError - Callback when an error occurs
 */
export async function sendChatMessage({ messages, onChunk, onDone, onError }) {
  try {
    const response = await fetch(BACKEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.apiPayload || m.content,
          images: m.images || [],
        })),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error?.message || `Server responded with status ${response.status}`);
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
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta && onChunk) {
            onChunk(delta);
          }
        } catch {}
      }

      if (onDone) onDone();
    } else {
      const data = await response.json();
      const fullContent = data.choices?.[0]?.message?.content || '';
      if (onChunk) onChunk(fullContent);
      if (onDone) onDone();
    }
  } catch (error) {
    console.error('API Service Error:', error);
    if (onError) onError(error);
  }
}
