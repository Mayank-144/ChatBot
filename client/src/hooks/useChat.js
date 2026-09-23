import { useState, useRef } from 'react';
import { sendChatMessage } from '../services/api';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const abortControllerRef = useRef(null);
  const isStoppedRef = useRef(false);

  const handleCopy = (text, index) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleStop = () => {
    isStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg
      )
    );
  };

  const handleClearChat = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isStoppedRef.current = true;
    setMessages([]);
    setInput('');
    setLoading(false);
    setCopiedIndex(null);
  };

  const handleSend = async ({ stagedFiles = [], clearStagedFiles }) => {
    const isParsing = stagedFiles.some((f) => f.status === 'parsing');
    if (isParsing) {
      alert('Please wait while the document is being processed...');
      return;
    }

    const hasInput = input.trim().length > 0;
    const hasFiles = stagedFiles.length > 0;

    if ((!hasInput && !hasFiles) || loading) return;

    // Attached file metadata for UI cards (including images)
    const attachedMetadata = stagedFiles.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      typeInfo: f.typeInfo,
      status: f.status,
      isImage: f.isImage,
      dataUrl: f.dataUrl,
    }));

    const imageFiles = stagedFiles.filter((f) => f.isImage && f.dataUrl && f.status === 'ready');
    const docFiles = stagedFiles.filter((f) => !f.isImage && f.status === 'ready');
    const imageUrls = imageFiles.map((f) => f.dataUrl);

    let promptText = input.trim();

    if (hasFiles) {
      const documentContexts = docFiles
        .map((f) => f.parsedContent)
        .filter(Boolean)
        .join('\n\n');

      if (!promptText) {
        if (imageFiles.length > 0 && docFiles.length === 0) {
          promptText = 'Please describe this image in detail and tell me what is happening in it.';
        } else {
          promptText =
            'Please analyze the attached document(s), provide a comprehensive overview and highlight the key data, insights, or findings.';
        }
      }

      var fullApiContent = documentContexts
        ? `[ATTACHED DOCUMENTS & DATA]\n\n${documentContexts}\n\n[USER REQUEST]\n${promptText}`
        : promptText;
    } else {
      var fullApiContent = promptText;
    }

    const userMessage = {
      role: 'user',
      content: input.trim() || (hasFiles ? `Uploaded: ${stagedFiles.map((f) => f.name).join(', ')}` : ''),
      files: attachedMetadata,
      images: imageUrls,
      apiPayload: fullApiContent,
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const assistantPlaceholder = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    const updatedMessages = [...messages, userMessage];

    setMessages([...updatedMessages, assistantPlaceholder]);
    setInput('');
    if (clearStagedFiles) clearStagedFiles();
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isStoppedRef.current = false;

    let fullResponseText = '';
    let streamFinished = false;
    let streamError = null;

    // Smooth Typewriter Queue Consumer
    const typewriterPromise = (async () => {
      let currentIndex = 0;
      let displayedText = '';

      await delay(250); // Initial natural thinking pause

      while (!streamFinished || currentIndex < fullResponseText.length) {
        if (isStoppedRef.current || streamError) break;

        if (currentIndex < fullResponseText.length) {
          const remaining = fullResponseText.length - currentIndex;
          let step = 1;
          let pauseMs = 18;

          if (remaining > 300) {
            step = Math.min(remaining, 5);
            pauseMs = 8;
          } else if (remaining > 80) {
            step = Math.min(remaining, 2);
            pauseMs = 14;
          } else {
            step = 1;
            pauseMs = 18;
          }

          if (fullResponseText[currentIndex] === '\n') {
            pauseMs = 45;
          }

          currentIndex = Math.min(fullResponseText.length, currentIndex + step);
          displayedText = fullResponseText.slice(0, currentIndex);

          if (!isStoppedRef.current) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: displayedText, isStreaming: true } : msg
              )
            );
          }

          await delay(pauseMs);
        } else {
          await delay(15);
        }
      }

      if (!streamError && !isStoppedRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: displayedText || fullResponseText || 'No response generated.',
                  isStreaming: false,
                }
              : msg
          )
        );
      }
    })();

    let capturedTools = [];

    // Call custom backend API
    await sendChatMessage({
      messages: updatedMessages,
      signal: abortController.signal,
      onToolsUsed: (tools) => {
        if (Array.isArray(tools) && tools.length > 0) {
          capturedTools = Array.from(new Set([...capturedTools, ...tools]));
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, toolsUsed: capturedTools } : msg
            )
          );
        }
      },
      onChunk: (chunk) => {
        if (!isStoppedRef.current) {
          fullResponseText += chunk;
        }
      },
      onDone: () => {
        streamFinished = true;
      },
      onError: (err) => {
        if (err.name === 'AbortError' || isStoppedRef.current) {
          streamFinished = true;
          return;
        }
        streamError = err;
        streamFinished = true;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: `Something went wrong: ${err.message}`, isStreaming: false }
              : msg
          )
        );
      },
    });

    await typewriterPromise;
    setLoading(false);
  };

  return {
    messages,
    input,
    setInput,
    loading,
    copiedIndex,
    handleSend,
    handleStop,
    handleClearChat,
    handleCopy,
  };
}

