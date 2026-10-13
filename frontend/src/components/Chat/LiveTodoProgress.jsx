import { useState } from 'react';

const SUBAGENT_CONFIG = {
  'research-agent': {
    label: 'Research Specialist',
    icon: '🔍',
  },
  'utility-agent': {
    label: 'Utility Specialist',
    icon: '⏱️',
  },
  'communication-agent': {
    label: 'Communication Specialist',
    icon: '✉️',
  },
  'math-time-agent': {
    label: 'Math & Time Specialist',
    icon: '⏱️',
  },
};

export function LiveTodoProgress({
  todos = [],
  subagents = [],
  approvalRequest = null,
  onApprove = null,
  onReject = null,
  isStreaming = false,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const hasTodos = Array.isArray(todos) && todos.length > 0;
  const hasSubagents = Array.isArray(subagents) && subagents.length > 0;
  const hasApproval = Boolean(approvalRequest || todos.some((t) => t.status === 'awaiting_approval'));

  if (!hasTodos && !hasSubagents && !hasApproval) {
    return null;
  }

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
  const awaitingCount = todos.filter((t) => t.status === 'awaiting_approval').length;
  const totalCount = todos.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;
  const isResolved = Boolean(approvalRequest?.resolvedStatus);

  return (
    <div className={`plan-progress-card ${hasApproval ? 'needs-approval' : ''}`}>
      {/* Collapsible Header */}
      <button
        type="button"
        className="plan-progress-header"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <div className="plan-progress-title">
          <span className="plan-icon">{hasApproval ? '🛡️' : '📋'}</span>
          <span className="plan-title-text">
            {hasApproval ? 'Human Approval Checkpoint' : 'Execution Plan & Subtasks'}
          </span>
          {hasTodos && (
            <span
              className={`plan-badge ${
                awaitingCount > 0 ? 'warning' : allCompleted ? 'done' : 'active'
              }`}
            >
              {awaitingCount > 0
                ? `${awaitingCount} Awaiting Approval`
                : allCompleted
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
          {/* Human-in-the-Loop Approval Action Banner */}
          {hasApproval && (
            <div className={`plan-approval-banner ${isResolved ? 'resolved' : ''}`}>
              <div className="plan-approval-info">
                <div className="plan-approval-header-row">
                  <span className="plan-approval-badge">🛡️ Action Requires Human Approval</span>
                  {isResolved && (
                    <span className={`plan-approval-status-tag ${approvalRequest.resolvedStatus}`}>
                      {approvalRequest.resolvedStatus === 'approved' ? '✓ Approved' : '✕ Rejected / Cancelled'}
                    </span>
                  )}
                </div>
                <p className="plan-approval-desc">
                  {approvalRequest?.action ||
                    'Please review and approve the sensitive action before execution.'}
                </p>

                {/* Email Draft Preview if applicable */}
                {approvalRequest?.payload?.to && (
                  <div className="approval-email-preview">
                    <div className="approval-email-row"><strong>To:</strong> {approvalRequest.payload.to}</div>
                    <div className="approval-email-row"><strong>Subject:</strong> {approvalRequest.payload.subject}</div>
                    {approvalRequest.payload.body && (
                      <div className="approval-email-body">{approvalRequest.payload.body}</div>
                    )}
                  </div>
                )}

                {approvalRequest?.estimatedCost && approvalRequest.estimatedCost !== 'N/A' && (
                  <span className="plan-approval-cost">
                    Budget / Cost: <strong>₹{approvalRequest.estimatedCost}</strong>
                  </span>
                )}
              </div>

              {!isResolved && (
                <div className="plan-approval-actions">
                  {onApprove && (
                    <button
                      type="button"
                      className="approval-btn approve"
                      onClick={() => onApprove(approvalRequest)}
                    >
                      ✓ Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      className="approval-btn reject"
                      onClick={() => onReject(approvalRequest)}
                    >
                      ✕ Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

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
                const isApproval = status === 'awaiting_approval';
                return (
                  <li key={todo.id || idx} className={`plan-todo-item ${status}`}>
                    <span className={`todo-check-icon ${status}`}>
                      {status === 'completed' && '✓'}
                      {status === 'in_progress' && (
                        <span className="todo-mini-spinner"></span>
                      )}
                      {isApproval && '🛡️'}
                      {status === 'pending' && '○'}
                    </span>
                    <span className={`todo-text ${status}`}>{todo.text}</span>
                    {isApproval && (
                      <span className="todo-approval-tag">Awaiting Approval</span>
                    )}
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
