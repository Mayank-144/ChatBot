import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncLocalStorage to pass the active sessionId and approval notifier down to tools
 * across asynchronous execution frames.
 */
export const approvalContext = new AsyncLocalStorage();

/**
 * In-memory map of active pending approvals awaiting user decision.
 * Key: approvalId -> Value: { approvalId, sessionId, action, details, payload, resolve, timeoutId, createdAt }
 */
const pendingApprovals = new Map();

/**
 * Maps sessionId to its current active approvalId.
 */
const sessionApprovals = new Map();

/**
 * Registers an approval request and GENUINELY PAUSES backend tool execution
 * until the human user approves or rejects it via the frontend.
 *
 * @param {Object} params
 * @param {string} params.action - Descriptive name of the action (e.g. "Send Email to team@example.com")
 * @param {string} params.details - Details/rationale for human inspection
 * @param {Object} [params.payload] - Structured action payload (e.g. email draft)
 * @param {number} [params.timeoutMs=120000] - Max wait time before auto-cancelling (default: 2 mins)
 * @returns {Promise<{ decision: 'approve' | 'reject', approvalId: string }>}
 */
export async function requestApprovalAndWait({
  action,
  details,
  payload = {},
  timeoutMs = 120000,
}) {
  const context = approvalContext.getStore() || {};
  const sessionId = context.sessionId || 'default';
  const notifyFn = context.onApprovalRequest;

  const approvalId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const approvalData = {
    approvalId,
    sessionId,
    action,
    details,
    payload,
    requiresDecision: true,
    createdAt: new Date().toISOString(),
  };

  // Broadcast to frontend SSE listener immediately
  if (notifyFn && typeof notifyFn === 'function') {
    notifyFn(approvalData);
  }

  return new Promise((resolve) => {
    // Safety timeout so request doesn't hang forever if user leaves
    const timeoutId = setTimeout(() => {
      console.warn(`[HITL] Approval timeout expired for ${approvalId}. Auto-rejecting.`);
      cleanup(approvalId, sessionId);
      resolve({ decision: 'reject', approvalId, reason: 'timeout' });
    }, timeoutMs);

    const record = {
      ...approvalData,
      resolve,
      timeoutId,
    };

    pendingApprovals.set(approvalId, record);
    sessionApprovals.set(sessionId, approvalId);
  });
}

/**
 * Cleans up pending approval entries from memory.
 */
function cleanup(approvalId, sessionId) {
  const record = pendingApprovals.get(approvalId);
  if (record?.timeoutId) {
    clearTimeout(record.timeoutId);
  }
  pendingApprovals.delete(approvalId);
  if (sessionApprovals.get(sessionId) === approvalId) {
    sessionApprovals.delete(sessionId);
  }
}

/**
 * Resolves a pending human approval with user's decision ('approve' or 'reject').
 * Wakes up the paused backend execution promise.
 *
 * @param {Object} params
 * @param {string} [params.approvalId] - Specific approval ID
 * @param {string} [params.sessionId] - Fallback lookup by sessionId
 * @param {'approve' | 'reject' | 'approved' | 'rejected'} params.decision
 * @returns {{ success: boolean, decision: string, approvalId: string | null }}
 */
export function resolveApproval({ approvalId, sessionId, decision }) {
  let targetId = approvalId;

  // Fallback to active session approval if specific ID not provided
  if (!targetId && sessionId) {
    targetId = sessionApprovals.get(sessionId);
  }

  if (!targetId || !pendingApprovals.has(targetId)) {
    console.warn(`[HITL] No pending approval found for ID: "${targetId}" (session: "${sessionId}").`);
    return {
      success: false,
      message: 'No active pending approval request found.',
      decision: null,
      approvalId: targetId || null,
    };
  }

  const record = pendingApprovals.get(targetId);
  const normalizedDecision =
    decision === 'approve' || decision === 'approved' ? 'approve' : 'reject';

  cleanup(targetId, record.sessionId);

  console.log(`[HITL] Human decision recorded for ${targetId}: [${normalizedDecision.toUpperCase()}]. Resuming backend execution.`);

  // Wake up the awaiting promise!
  record.resolve({
    decision: normalizedDecision,
    approvalId: targetId,
    payload: record.payload,
  });

  return {
    success: true,
    decision: normalizedDecision,
    approvalId: targetId,
  };
}

/**
 * Returns any pending approval currently waiting for a session.
 * @param {string} sessionId
 * @returns {Object|null}
 */
export function getPendingApproval(sessionId) {
  const approvalId = sessionApprovals.get(sessionId);
  if (approvalId && pendingApprovals.has(approvalId)) {
    const record = pendingApprovals.get(approvalId);
    return {
      approvalId: record.approvalId,
      action: record.action,
      details: record.details,
      payload: record.payload,
      createdAt: record.createdAt,
    };
  }
  return null;
}

/**
 * Clears any pending approvals for a session.
 * @param {string} sessionId
 */
export function clearSessionApprovals(sessionId) {
  const approvalId = sessionApprovals.get(sessionId);
  if (approvalId) {
    cleanup(approvalId, sessionId);
  }
}

export default {
  approvalContext,
  requestApprovalAndWait,
  resolveApproval,
  getPendingApproval,
  clearSessionApprovals,
};
