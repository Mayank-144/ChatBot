import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getModel, getGroqModel } from './index.js';
import { leadsTool, fetchBusinessLeads } from '../tools/leadsTool.js';
import { emailTool, sendLeadsEmail } from '../tools/emailTool.js';
import { recordTurn, getSessionMessages } from './memory.js';

export const LEADS_AGENT_SYSTEM_PROMPT = `You are a Business Intelligence Agent. Find top 5 genuine business leads for the requested industry/location, verify they are real companies, format nicely, and email the report.

Guidelines:
1. Always invoke 'search_business_leads' with the extracted target industry and location to obtain 5 verified companies with company name, website, contact email, phone, and description.
2. If the user mentions emailing, sending, or dispatching the report, invoke 'send_leads_email' with the structured leads list.
3. In your final response, provide a clean, professional Markdown table presenting all 5 leads:
   | # | Company Name | Website | Contact Email | Phone | Description |
4. State clearly whether the email report was dispatched or simulated based on environment configuration.`;

/**
 * Creates or retrieves the specialized LangGraph Leads Agent instance.
 * @returns {any}
 */
export function getOrCreateLeadsAgent() {
  let model;
  try {
    model = getModel({ temperature: 0.2 });
  } catch {
    model = getGroqModel({ temperature: 0.2 });
  }

  return createReactAgent({
    llm: model,
    tools: [leadsTool, emailTool],
    messageModifier: new SystemMessage(LEADS_AGENT_SYSTEM_PROMPT),
  });
}

/**
 * Runs the specialized Leads Agent independently.
 * @param {string|Object} query - The search query or payload { query, industry, location, sendEmail, recipientEmail }
 * @param {string} [sessionId='leads_session'] - Unique session identifier
 * @param {Object} [options] - Additional runtime options
 * @returns {Promise<{ output: string, leads: Array<Object>, emailStatus: Object, toolCalls: Array<Object> }>}
 */
export async function runLeadsAgent(query, sessionId = 'leads_session', options = {}) {
  let queryText = '';
  let industry = '';
  let location = '';
  let sendEmail = false;
  let recipientEmail = null;

  if (typeof query === 'string') {
    queryText = query;
    if (/\b(?:email|send|mail|bhejo)\b/i.test(queryText)) {
      sendEmail = true;
    }
  } else if (query && typeof query === 'object') {
    queryText = query.query || `${query.industry || 'tech'} companies in ${query.location || 'India'}`;
    industry = query.industry || '';
    location = query.location || '';
    sendEmail = Boolean(query.sendEmail);
    recipientEmail = query.recipientEmail || null;
  }

  console.log(`[LEADS_AGENT] Running leads agent for: "${queryText}" (sendEmail: ${sendEmail})`);

  // Direct fetch of verified 5 leads for deterministic structured output
  const leads = await fetchBusinessLeads({
    industry: industry || queryText,
    location: location || '',
    query: queryText,
  });

  let emailStatus = null;
  if (sendEmail) {
    emailStatus = await sendLeadsEmail(leads, recipientEmail);
  }

  // Format final readable markdown response
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const tableRows = leads
    .map(
      (l, idx) =>
        `| ${idx + 1} | **${l.companyName}** | [${l.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}](${l.website}) | \`${l.email}\` | ${l.phone} | ${l.description} |`
    )
    .join('\n');

  let emailNote = '';
  if (emailStatus) {
    if (emailStatus.simulated) {
      emailNote = `\n\n> 📧 **Email Status:** Delivered in simulation mode to \`${emailStatus.recipient}\` (Configure \`EMAIL_USER\` and \`EMAIL_PASS\` in \`.env\` for live SMTP dispatch).`;
    } else if (emailStatus.success) {
      emailNote = `\n\n> 📧 **Email Status:** ✅ Successfully sent HTML report to \`${emailStatus.recipient}\`.`;
    } else {
      emailNote = `\n\n> ⚠️ **Email Status:** ${emailStatus.message}`;
    }
  }

  const output = `### 🎯 Top 5 Business Leads — ${dateStr}\n\nHere are the verified business intelligence leads based on your request:\n\n| # | Company Name | Website | Contact Email | Phone | Description |\n|---|---|---|---|---|---|\n${tableRows}${emailNote}`;

  // Record completed turn into session memory
  await recordTurn(sessionId, queryText, output);

  return {
    output,
    leads,
    emailStatus,
    toolCalls: [
      { name: 'search_business_leads', input: { query: queryText } },
      ...(sendEmail ? [{ name: 'send_leads_email', input: { recipientEmail } }] : []),
    ],
  };
}

export default {
  runLeadsAgent,
  getOrCreateLeadsAgent,
  LEADS_AGENT_SYSTEM_PROMPT,
};
