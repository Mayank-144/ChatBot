import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyIcon, CheckIcon } from '../Icons/Icons';
import { FileCard } from './FileCard';

export function MessageItem({ msg, index, copiedIndex, onCopy }) {
  return (
    <div className={`message-item ${msg.role}`}>
      <div className="message-meta">
        <span className={`sender-name ${msg.role}`}>
          {msg.role === 'user' ? 'User' : '🤖 Mayank'}
        </span>
        {msg.isStreaming && !msg.content && (
          <span className="message-status">thinking...</span>
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

      {/* Message Body */}
      <div className="message-body">
        {msg.role === 'assistant' ? (
          <div className="markdown-render">
            {msg.content ? (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="markdown-paragraph">{children}</p>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
                {msg.isStreaming && <span className="streaming-cursor"></span>}
              </>
            ) : (
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
          </div>
        ) : (
          msg.content && <p className="user-text">{msg.content}</p>
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
