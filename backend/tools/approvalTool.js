import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { requestApprovalAndWait } from '../agent/approvalManager.js';

/**
 * Zod schema for Human-in-the-Loop approval requests.
 */
const humanApprovalSchema = z.object({
  action: z
    .string()
    .describe('The critical, financial, or sensitive action requiring human approval (e.g. "Finalize 3-city travel booking & pay ₹11,700")'),
  details: z
    .string()
    .describe('Clear rationale, breakdown, or conditions for human review'),
  estimatedCost: z
    .string()
    .optional()
    .describe('Estimated budget or financial cost if applicable (e.g. "500")'),
});

/**
 * Tool for requesting explicit human approval before executing sensitive or high-impact actions.
 */
export const requestHumanApprovalTool = tool(
  async ({ action, details, estimatedCost }) => {
    const result = await requestApprovalAndWait({
      action,
      details,
      payload: { action, details, estimatedCost },
    });

    if (result.decision === 'reject') {
      return JSON.stringify({
        status: 'rejected',
        action,
        decision: 'reject',
        cost: estimatedCost || 'N/A',
        instruction: 'CRITICAL: The user has explicitly REJECTED and CANCELLED this action. STOP immediately. Do NOT generate full itineraries, logistical schedules, contingency plans, or lengthy reports. Output ONLY a concise cancellation notice (2-3 sentences) confirming that the action was rejected by the reviewer and the operation has been aborted.',
      });
    }

    return JSON.stringify({
      status: 'approved',
      action,
      decision: 'approve',
      cost: estimatedCost || 'N/A',
      instruction: 'The user has APPROVED this action. Proceed with full execution and provide the comprehensive finalized report.',
    });
  },
  {
    name: 'request_human_approval',
    description:
      'Request explicit human approval before finalizing transactions, booking expenses, or executing critical actions in a multi-step plan.',
    schema: humanApprovalSchema,
  }
);

export default requestHumanApprovalTool;
