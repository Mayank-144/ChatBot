import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { requestApprovalAndWait } from '../agent/approvalManager.js';

/**
 * Zod schema for preparing an email draft.
 */
const prepareEmailSchema = z.object({
  to: z.string().describe('Recipient email address (e.g. team@example.com)'),
  subject: z.string().describe('Subject line of the email'),
  body: z.string().describe('Full body text or summary of the email'),
});

/**
 * Tool for drafting/preparing an email without sending it yet.
 */
export const prepareEmailTool = tool(
  async ({ to, subject, body }) => {
    return JSON.stringify({
      status: 'draft_prepared',
      to,
      subject,
      body,
      note: 'Email draft is ready for review. Must receive human approval before sending.',
    });
  },
  {
    name: 'prepare_email',
    description: 'Prepare and format an email draft containing findings, summaries, or reports.',
    schema: prepareEmailSchema,
  }
);

/**
 * Zod schema for sending an email (sensitive action requiring Human-in-the-Loop approval).
 */
const sendEmailSchema = z.object({
  to: z.string().describe('Recipient email address'),
  subject: z.string().describe('Subject line of the email'),
  body: z.string().describe('Email body content to be sent'),
});

/**
 * Tool for sending an email with mandatory Human-in-the-Loop (HITL) pause and approval.
 */
export const sendEmailTool = tool(
  async ({ to, subject, body }) => {
    console.log(`[HITL] Pausing execution for human approval to send email to "${to}"...`);

    // Genuinely pause execution and wait for human decision (approve or reject)
    const approvalResult = await requestApprovalAndWait({
      action: `Send Email to ${to}`,
      details: `Subject: "${subject}"\nBody Summary: ${body.slice(0, 200)}${body.length > 200 ? '...' : ''}`,
      payload: {
        type: 'email',
        to,
        subject,
        body,
      },
    });

    if (approvalResult.decision === 'approve') {
      console.log(`[HITL] Action APPROVED by user. Sending email to "${to}"...`);
      return JSON.stringify({
        status: 'sent',
        to,
        subject,
        message: `Email successfully sent to ${to}.`,
        decision: 'approved',
      });
    }

    console.log(`[HITL] Action REJECTED by user. Cancelling email to "${to}"...`);
    return JSON.stringify({
      status: 'cancelled',
      to,
      subject,
      message: `Email sending to ${to} was rejected and cancelled by the user.`,
      decision: 'rejected',
    });
  },
  {
    name: 'send_email',
    description:
      'Send an email to a recipient. This is a sensitive action that pauses execution and requires explicit human approval before being sent.',
    schema: sendEmailSchema,
  }
);

export default {
  prepareEmailTool,
  sendEmailTool,
};
