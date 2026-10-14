import nodemailer from 'nodemailer';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Builds a clean, professional HTML table formatted for business leads reports.
 * @param {Array<Object>} leads
 * @param {string} dateStr
 * @returns {string} HTML string
 */
function buildLeadsHtmlTable(leads = [], dateStr = '') {
  const rows = leads
    .map(
      (lead, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 0 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
      <td style="padding: 12px 14px; font-weight: 600; color: #475569; text-align: center;">${idx + 1}</td>
      <td style="padding: 12px 14px; font-weight: bold; color: #0f172a;">${lead.companyName || 'N/A'}</td>
      <td style="padding: 12px 14px;">
        <a href="${lead.website}" target="_blank" style="color: #2563eb; text-decoration: none; word-break: break-all;">
          ${lead.website ? lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'N/A'}
        </a>
      </td>
      <td style="padding: 12px 14px; color: #1e293b;">
        <a href="mailto:${lead.email}" style="color: #0d9488; text-decoration: none; font-weight: 500;">
          ${lead.email || 'N/A'}
        </a>
      </td>
      <td style="padding: 12px 14px; color: #334155; font-family: monospace; white-space: nowrap;">
        ${lead.phone || 'N/A'}
      </td>
      <td style="padding: 12px 14px; color: #64748b; font-size: 0.9em; line-height: 1.4;">
        ${lead.description || 'Verified enterprise lead.'}
      </td>
    </tr>
  `
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Top 5 Business Leads</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
    <div style="max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; color: #ffffff;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
          🎯 Top 5 Business Leads
        </h1>
        <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px;">
          Generated & Verified by Mayank AI Leads Agent • ${dateStr}
        </p>
      </div>

      <div style="padding: 24px 32px;">
        <p style="color: #334155; font-size: 15px; margin-top: 0;">
          Here is your verified business intelligence report containing top targeted company leads:
        </p>

        <div style="overflow-x: auto; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; border: 1px solid #e2e8f0;">
            <thead>
              <tr style="background: #f1f5f9; color: #334155; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em;">
                <th style="padding: 12px 14px; width: 40px; text-align: center;">#</th>
                <th style="padding: 12px 14px;">Company Name</th>
                <th style="padding: 12px 14px;">Website</th>
                <th style="padding: 12px 14px;">Contact Email</th>
                <th style="padding: 12px 14px;">Phone</th>
                <th style="padding: 12px 14px;">Description</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; display: flex; justify-content: space-between;">
          <span>Automated Daily Business Leads Report</span>
          <span>Powered by Mayank AI Agent</span>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * Creates Nodemailer transporter based on .env config.
 */
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    return null;
  }

  // Support Gmail or custom SMTP
  const isGmail = user.includes('@gmail.com');
  if (isGmail) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
}

/**
 * Sends a structured email report of 5 business leads.
 * @param {Array<Object>} leads - Array of lead objects
 * @param {string} [recipientEmail] - Target email recipient
 * @returns {Promise<{ success: boolean, message: string, simulated?: boolean }>}
 */
export async function sendLeadsEmail(leads = [], recipientEmail = null) {
  const to = recipientEmail || process.env.EMAIL_TO || process.env.EMAIL_USER;
  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const subject = `🎯 Top 5 Business Leads — ${todayStr}`;

  if (!Array.isArray(leads) || leads.length === 0) {
    return {
      success: false,
      message: 'No leads data provided to email.',
    };
  }

  const transporter = createTransporter();
  const htmlContent = buildLeadsHtmlTable(leads, todayStr);

  // If credentials are not configured, simulate delivery safely
  if (!transporter || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn(`[EMAIL_TOOL] Credentials missing in .env. Simulating email to: ${to || 'configured recipient'}`);
    return {
      success: true,
      simulated: true,
      recipient: to || 'recipient@example.com',
      subject,
      message: `Email report simulated successfully for ${leads.length} leads (configured EMAIL_USER/EMAIL_PASS credentials not set in .env).`,
    };
  }

  if (!to) {
    return {
      success: false,
      message: 'No recipient email specified (provide recipientEmail or set EMAIL_TO in .env).',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Mayank AI Leads" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL_TOOL] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
      recipient: to,
      subject,
      message: `Email successfully delivered to ${to}.`,
    };
  } catch (error) {
    console.error(`[EMAIL_TOOL] Failed to send email via SMTP:`, error.message);
    return {
      success: false,
      error: error.message,
      message: `Failed to deliver email: ${error.message}`,
    };
  }
}

/**
 * Zod schema for email tool.
 */
const emailToolSchema = z.object({
  leads: z
    .array(
      z.object({
        companyName: z.string(),
        website: z.string(),
        email: z.string(),
        phone: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .describe('List of 5 business leads to format and send'),
  recipientEmail: z
    .string()
    .optional()
    .describe('Recipient email address (defaults to EMAIL_TO or EMAIL_USER from environment)'),
});

/**
 * LangChain Tool for sending leads emails.
 */
export const emailTool = tool(
  async ({ leads, recipientEmail }) => {
    const result = await sendLeadsEmail(leads, recipientEmail);
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'send_leads_email',
    description:
      'Send a professional HTML table email containing verified business leads to the designated recipient.',
    schema: emailToolSchema,
  }
);

export default emailTool;
