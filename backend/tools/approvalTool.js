import { tool } from '@langchain/core/tools';
import { z } from 'zod';

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
    .union([z.string(), z.number()])
    .optional()
    .describe('Estimated budget or financial cost if applicable'),
});

/**
 * Tool for requesting explicit human approval before executing sensitive or high-impact actions.
 */
export const requestHumanApprovalTool = tool(
  async ({ action, details, estimatedCost }) => {
    return JSON.stringify({
      status: 'awaiting_approval',
      action,
      cost: estimatedCost || 'N/A',
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
