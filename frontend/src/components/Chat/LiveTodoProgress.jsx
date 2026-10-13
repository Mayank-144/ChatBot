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
  'math-time-agent': {
    label: 'Math & Time Specialist',
    icon: '🧮',
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
  const [submittingAction, setSubmittingAction] = useState(null); // 'approve' | 'reject' | null

  const hasTodos = Array.isArray(todos) && todos.length > 0;
  const hasSubagents = Array.isArray(subagents) && subagents.length > 0;

  const awaitingTodo = todos.find((t) => t.status === 'awaiting_approval');
  const hasApproval = Boolean(approvalRequest || awaitingTodo);

  if (!hasTodos && !hasSubagents && !hasApproval) {
    return null;
  }

  // Construct effective approval object even if SSE hasn't populated full approvalRequest
  const effectiveApproval = approvalRequest || (awaitingTodo ? {
    approvalId: null,
    action: awaitingTodo.text || 'Sensitive Action Approval',
    details: 'Human authorization is required before executing this sensitive action.',
  } : null);

  const isResolved = Boolean(
    approvalRequest?.resolvedStatus ||
    (effectiveApproval && awaitingTodo && awaitingTodo.status !== 'awaiting_approval')
  );

  const resolvedStatus =
    approvalRequest?.resolvedStatus ||
    (awaitingTodo?.status === 'completed' ? 'approved' : awaitingTodo?.status === 'cancelled' || awaitingTodo?.status === 'rejected' ? 'rejected' : null);

  const completedCount = todos.filter((t) => t.status === 'completed').length;
  const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
  const awaitingCount = todos.filter((t) => t.status === 'awaiting_approval').length;
  const totalCount = todos.length;
  const allCompleted = totalCount > 0 && completedCount === totalCount;

  const handleApproveClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (submittingAction || isResolved) return;
    setSubmittingAction('approve');
    try {
      if (onApprove) {
        await onApprove(effectiveApproval);
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRejectClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (submittingAction || isResolved) return;
    setSubmittingAction('reject');
    try {
      if (onReject) {
        await onReject(effectiveApproval);
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const actionDisplay =
    effectiveApproval?.action ||
    awaitingTodo?.text ||
    'Execute Critical Action';

  const detailsDisplay =
    effectiveApproval?.details ||
    'Please review and authorize this action before execution continues.';

  const estimatedCost = effectiveApproval?.estimatedCost || effectiveApproval?.payload?.estimatedCost;

  return (
    <div className={`plan-progress-card ${hasApproval && !isResolved ? 'needs-approval' : ''} ${isResolved ? 'resolved-card' : ''}`}>
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
            {hasApproval
              ? isResolved
                ? 'Human Approval Checkpoint (Completed)'
                : 'Human Approval Checkpoint'
              : 'Execution Plan & Subtasks'}
          </span>
          {hasTodos && (
            <span
              className={`plan-badge ${
                awaitingCount > 0 ? 'warning' : allCompleted ? 'done' : 'active'
              }`}
            >
              {awaitingCount > 0
                ? `${awaitingCount} Awaiting Decision`
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
            <div className={`plan-approval-banner ${isResolved ? 'resolved ' + resolvedStatus : 'active-checkpoint'}`}>
              <div className="plan-approval-info">
                <div className="plan-approval-header-row">
                  <div className="plan-approval-tag-group">
                    <span className="plan-approval-badge">
                      <span className="shield-icon">🛡️</span>
                      <span>Action Requires Human Approval</span>
                    </span>
                    {!isResolved && (
                      <span className="approval-live-pulse-tag">Decision Needed</span>
                    )}
                  </div>

                  {isResolved && (
                    <span className={`plan-approval-status-tag ${resolvedStatus || 'approved'}`}>
                      {resolvedStatus === 'approved' ? '✓ Approved by User' : '✕ Rejected / Cancelled'}
                    </span>
                  )}
                </div>

                <div className="plan-approval-main-desc">
                  <span className="approval-action-title">{actionDisplay}</span>
                  <p className="plan-approval-subtext">
                    {isResolved
                      ? resolvedStatus === 'approved'
                        ? 'This sensitive action was authorized by you and executed by the AI coordinator.'
                        : 'This sensitive action was rejected by you and execution was cancelled.'
                      : detailsDisplay}
                  </p>
                </div>

                {estimatedCost && estimatedCost !== 'N/A' && (
                  <div className="approval-cost-badge">
                    <span>Estimated Cost:</span>
                    <strong>₹{estimatedCost}</strong>
                  </div>
                )}
              </div>

              {/* Action Buttons with high-contrast, tactile states and loading indicator */}
              {!isResolved && (
                <div className="plan-approval-actions">
                  {onApprove && (
                    <button
                      type="button"
                      className={`approval-btn approve ${submittingAction === 'approve' ? 'is-loading' : ''}`}
                      onClick={handleApproveClick}
                      disabled={Boolean(submittingAction)}
                      aria-label="Approve this sensitive action"
                    >
                      {submittingAction === 'approve' ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">✓</span>
                          <span>Approve Action</span>
                        </>
                      )}
                    </button>
                  )}

                  {onReject && (
                    <button
                      type="button"
                      className={`approval-btn reject ${submittingAction === 'reject' ? 'is-loading' : ''}`}
                      onClick={handleRejectClick}
                      disabled={Boolean(submittingAction)}
                      aria-label="Reject this sensitive action"
                    >
                      {submittingAction === 'reject' ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Rejecting...</span>
                        </>
                      ) : (
                        <>
                          <span className="btn-icon">✕</span>
                          <span>Reject & Cancel</span>
                        </>
                      )}
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
                      {isDone ? '✓' : 'running'}
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
                      {status === 'cancelled' && '✕'}
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
