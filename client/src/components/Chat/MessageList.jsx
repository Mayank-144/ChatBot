import { useEffect, useRef } from 'react';
import { EmptyState } from './EmptyState';
import { MessageItem } from './MessageItem';

export function MessageList({ messages, loading, copiedIndex, onCopy }) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="messages-container">
      {messages.length === 0 && <EmptyState />}

      {messages.map((msg, index) => (
        <MessageItem
          key={msg.id || index}
          msg={msg}
          index={index}
          copiedIndex={copiedIndex}
          onCopy={onCopy}
        />
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
