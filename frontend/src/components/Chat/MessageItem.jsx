import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyIcon, CheckIcon, MaximizeIcon, MinimizeIcon } from '../Icons/Icons';
import { FileCard } from './FileCard';
import { LiveTodoProgress } from './LiveTodoProgress';

const TOOL_CONFIG = {
  get_weather: {
    icon: '🌤️',
    label: 'Live Weather',
  },
  wikipedia_search: {
    icon: '📚',
    label: 'Wikipedia',
  },
  calculator: {
    icon: '🧮',
    label: 'MCP Calculator',
  },
  get_time: {
    icon: '🕒',
    label: 'MCP Time',
  },
  request_human_approval: {
    icon: '🛡️',
    label: 'Human Approval',
  },
  delegate_to_research_agent: {
    icon: '🔍',
    label: 'Research Agent',
  },
  delegate_to_utility_agent: {
    icon: '⏱️',
    label: 'Utility Agent',
  },
};

function cleanAssistantContent(content) {
  if (!content || typeof content !== 'string') return content;
  // Cleanly strip any redundant human approval status blocks if produced by the LLM
  return content
    .replace(
      /(?:^|\n)(?:#{1,4}\s*)?(?:\d+\.?\s*)?(?:Human\s+Approval|Approval\s+(?:&|and)\s+Budget|Reviewer\s+Approval|Budget\s+Authorization)[^\n]*\n(?:\s*[-*•]\s*[^\n]*\n?){1,5}/gi,
      '\n'
    )
    .trim();
}

export function MessageItem({ msg, index, copiedIndex, onCopy, onApprove, onReject }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayContent = msg.role === 'assistant' ? cleanAssistantContent(msg.content) : msg.content;

  return (
    <div className={`message-item ${msg.role} ${isExpanded ? 'is-expanded' : ''}`}>
      <div className="message-header-bar">
        <div className="message-meta">
          <span className={`sender-name ${msg.role}`}>
            {msg.role === 'user' ? 'User' : '🤖 Mayank AI'}
          </span>
        </div>
        {displayContent && (
          <button
            type="button"
            className="msg-expand-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Collapse content' : 'Expand full content (⤢)'}
            aria-label={isExpanded ? 'Collapse content' : 'Expand content'}
          >
            {isExpanded ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>
        )}
      </div>

      {/* Render Attached Files */}
      {msg.files && msg.files.length > 0 && (
        <div className="message-attachments-list">
          {msg.files.map((fileItem, fIdx) => (
            <FileCard key={fIdx} fileItem={fileItem} />
          ))}
        </div>
      )}

      {/* Tool Used Badges */}
      {msg.toolsUsed && msg.toolsUsed.length > 0 && (
        <div className="message-tools-badges">
          {msg.toolsUsed.map((tool, tIdx) => {
            const config = TOOL_CONFIG[tool] || {
              icon: '⚡',
              label: `Tool: ${tool}`,
            };
            return (
              <span key={tIdx} className={`tool-used-badge tool-badge-${tool}`}>
                <span className="tool-icon">{config.icon}</span>
                <span className="tool-name">{config.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Deep Agent Plan & Subagent Progress */}
      {msg.role === 'assistant' && (
        <LiveTodoProgress
          todos={msg.todos}
          subagents={msg.subagents}
          approvalRequest={msg.approvalRequest}
          onApprove={onApprove}
          onReject={onReject}
          isStreaming={msg.isStreaming}
        />
      )}

      {/* Message Body */}
      <div className="message-body">
        {msg.role === 'assistant' ? (
          <div className="markdown-render">
            {displayContent ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
                {msg.isStreaming && <span className="streaming-cursor"></span>}
              </>
            ) : (
              <div className="thinking-bubble">
                <span className="thinking-pulse-dot"></span>
                <span className="thinking-label">Thinking...</span>
              </div>
            )}
          </div>
        ) : (
          displayContent && <p className="user-text">{displayContent}</p>
        )}
      </div>

      {/* Copy Button */}
      {msg.content && (
        <div className="message-actions">
          <button
            type="button"
            className="copy-icon-btn"
            onClick={() => onCopy(msg.content, index)}
            title={copiedIndex === index ? 'Copied!' : 'Copy message'}
          >
            {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}
    </div>
  );
}
