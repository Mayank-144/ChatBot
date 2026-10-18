import { useState, useRef } from 'react';
import { sendChatMessage, submitApprovalDecision, BACKEND_BASE } from '../services/api';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const createSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export function useChat() {
  const [sessionId, setSessionId] = useState(createSessionId);
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

    // Reset memory for previous session on backend
    const clearUrl = BACKEND_BASE ? `${BACKEND_BASE}/api/memory/clear` : '/api/memory/clear';
    fetch(clearUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});

    // Generate fresh session ID for new conversation
    setSessionId(createSessionId());
    setMessages([]);
    setInput('');
    setLoading(false);
    setCopiedIndex(null);
  };

  const handleSend = async (options = {}, overrideText = '') => {
    const { stagedFiles = [], clearStagedFiles } = options || {};
    const isParsing = stagedFiles.some((f) => f.status === 'parsing');
    if (isParsing) {
      alert('Please wait while the document is being processed...');
      return;
    }

    const activeText = (typeof overrideText === 'string' && overrideText.trim() ? overrideText : input).trim();
    const hasInput = activeText.length > 0;
    const hasFiles = stagedFiles.length > 0;

    if (!hasInput && !hasFiles) return;
    if (loading && !overrideText) return;

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

    let promptText = activeText;

    let fullApiContent = promptText;

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

      fullApiContent = documentContexts
        ? `[ATTACHED DOCUMENTS & DATA]\n\n${documentContexts}\n\n[USER REQUEST]\n${promptText}`
        : promptText;
    }

    const userMessage = {
      role: 'user',
      content: activeText || (hasFiles ? `Uploaded: ${stagedFiles.map((f) => f.name).join(', ')}` : ''),
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
      agentRoute: null,
      todos: [],
      subagents: [],
      approvalRequest: null,
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
      sessionId,
      signal: abortController.signal,
      onAgentRoute: (route) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId ? { ...msg, agentRoute: route } : msg
          )
        );
      },
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
      onTodos: (incomingTodos) => {
        if (Array.isArray(incomingTodos) && incomingTodos.length > 0) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId ? { ...msg, todos: incomingTodos } : msg
            )
          );
        }
      },
      onSubagent: (subagentEvt) => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id !== assistantMsgId) return msg;
            const currentSubagents = Array.isArray(msg.subagents) ? [...msg.subagents] : [];
            const existingIdx = currentSubagents.findIndex(
              (s) => s.name === subagentEvt.name
            );
            if (existingIdx >= 0) {
              currentSubagents[existingIdx] = {
                ...currentSubagents[existingIdx],
                ...subagentEvt,
              };
            } else {
              currentSubagents.push(subagentEvt);
            }
            return { ...msg, subagents: currentSubagents };
          })
        );
      },
      onApprovalRequest: (approvalReq) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, approvalRequest: approvalReq }
              : msg
          )
        );
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

  const handleApprove = async (approvalReq) => {
    const approvalId = approvalReq?.approvalId;
    const actionName = approvalReq?.action || 'Approved sensitive action';

    // Optimistically update message state so user gets immediate visual confirmation
    setMessages((prev) =>
      prev.map((m) => {
        const matchesApproval =
          (approvalId && m.approvalRequest?.approvalId === approvalId) ||
          m.approvalRequest ||
          m.todos?.some((t) => t.status === 'awaiting_approval');

        if (matchesApproval) {
          const updatedTodos = (m.todos || []).map((t) =>
            t.status === 'awaiting_approval' ? { ...t, status: 'completed' } : t
          );
          return {
            ...m,
            todos: updatedTodos,
            approvalRequest: {
              ...(m.approvalRequest || {}),
              action: actionName,
              resolvedStatus: 'approved',
            },
          };
        }
        return m;
      })
    );

    // Send decision to backend (with sessionId fallback)
    try {
      await submitApprovalDecision({
        approvalId: approvalId || undefined,
        sessionId,
        decision: 'approve',
      });
    } catch (err) {
      console.warn('Approval decision submit notice:', err);
    }

    // If streaming has finished and agent is idle, trigger next turn with approval acknowledgment
    if (!loading) {
      const text = approvalReq?.action
        ? `Approved: Proceed with "${approvalReq.action}".`
        : 'Approved: Proceed with the action.';
      handleSend({}, text);
    }
  };

  const handleReject = async (approvalReq) => {
    const approvalId = approvalReq?.approvalId;
    const actionName = approvalReq?.action || 'Rejected sensitive action';

    // Optimistically update message state
    setMessages((prev) =>
      prev.map((m) => {
        const matchesApproval =
          (approvalId && m.approvalRequest?.approvalId === approvalId) ||
          m.approvalRequest ||
          m.todos?.some((t) => t.status === 'awaiting_approval');

        if (matchesApproval) {
          const updatedTodos = (m.todos || []).map((t) =>
            t.status === 'awaiting_approval' ? { ...t, status: 'cancelled' } : t
          );
          return {
            ...m,
            todos: updatedTodos,
            approvalRequest: {
              ...(m.approvalRequest || {}),
              action: actionName,
              resolvedStatus: 'rejected',
            },
          };
        }
        return m;
      })
    );

    // Send rejection decision to backend
    try {
      await submitApprovalDecision({
        approvalId: approvalId || undefined,
        sessionId,
        decision: 'reject',
      });
    } catch (err) {
      console.warn('Approval reject submit notice:', err);
    }

    if (!loading) {
      const text = approvalReq?.action
        ? `Rejected: Cancel "${approvalReq.action}". Do not execute it.`
        : 'Rejected: Cancel this action.';
      handleSend({}, text);
    }
  };

  return {
    sessionId,
    messages,
    input,
    setInput,
    loading,
    copiedIndex,
    handleSend,
    handleStop,
    handleClearChat,
    handleCopy,
    handleApprove,
    handleReject,
  };
}

