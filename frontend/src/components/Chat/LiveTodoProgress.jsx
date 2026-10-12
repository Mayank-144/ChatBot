import { useState } from 'react';

const SUBAGENT_CONFIG = {
  'research-agent': {
    label: 'Research Specialist',
    icon: '🔍',
  },
  'math-time-agent': {
    label: 'Math & Time Specialist',
    icon: '⏱️',
  },
};

export function LiveTodoProgress({ todos = [], subagents = [], isStreaming = false }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasTodos = Array.isArray(todos) && todos.length > 0;
  const hasSubagents = Array.isArray(subagents) && subagents.length > 0;

  if (!hasTodos && !hasSubagents) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
  const totalCount = todos.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="plan-progress-card">
      {/* Collapsible Header */}
      <button
        type="button"
        className="plan-progress-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <div className="plan-progress-title">
          <span className="plan-icon">📋</span>
          <span className="plan-title-text">Execution Plan & Progress</span>
          {hasTodos && (
            <span className={`plan-badge ${allCompleted ? 'done' : 'active'}`}>
              {allCompleted
                ? `All ${totalCount} Done ✓`
                : `${completedCount}/${totalCount} Completed`}
            </span>
          )}
        </div>

        <div className="plan-header-right">
          {isStreaming && inProgressCount > 0 && (
            <span className="plan-live-dot" title="Working on tasks..."></span>
          )}
          <span className={`plan-chevron ${isExpanded ? 'open' : ''}`}>▼</span>
        </div>
      </button>

      {/* Collapsible Body */}
      {isExpanded && (
        <div className="plan-progress-content">
          {/* Subagent Badges */}
          {hasSubagents && (
            <div className="subagent-pills-row">
              <span className="subagent-row-label">Agents:</span>
              {subagents.map((sub, idx) => {
                const config = SUBAGENT_CONFIG[sub.name] || {
                  label: sub.name,
                  icon: '🤖',
                };
                const isDone = sub.status === 'completed';
                return (
                  <span
                    key={idx}
                    className={`subagent-pill ${isDone ? 'completed' : 'running'}`}
                    title={sub.task ? `Task: ${sub.task}` : undefined}
                  >
                    <span className="subagent-icon">{config.icon}</span>
                    <span className="subagent-name">{config.label}</span>
                    <span className="subagent-status-tag">
                      {isDone ? '✓' : 'in progress'}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Checklist */}
          {hasTodos && (
            <ul className="plan-todo-list">
              {todos.map((todo, idx) => {
                const status = todo.status || 'pending';
                return (
                  <li key={todo.id || idx} className={`plan-todo-item ${status}`}>
                    <span className={`todo-check-icon ${status}`}>
                      {status === 'completed' && '✓'}
                      {status === 'in_progress' && (
                        <span className="todo-mini-spinner"></span>
                      )}
                      {status === 'pending' && '○'}
                    </span>
                    <span className={`todo-text ${status}`}>{todo.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default LiveTodoProgress;
