import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { wikiTool } from '../tools/wikiTool.js';
import { weatherTool } from '../tools/weatherTool.js';
import { calculatorTool } from '../tools/calculatorTool.js';
import { timeTool } from '../tools/timeTool.js';

/**
 * Module-level listener for subagent lifecycle events (start, complete).
 */
let subagentEventListener = null;

export function setSubagentEventListener(listener) {
  subagentEventListener = listener;
}

function notifySubagent(event) {
  if (subagentEventListener && typeof subagentEventListener === 'function') {
    subagentEventListener(event);
  }
}

// =========================================================================
// 1. RESEARCH AGENT
// Specialized sub-agent handling Wikipedia and factual information gathering
// =========================================================================
export const delegateToResearchAgentTool = tool(
  async ({ query, task, entity, topic }) => {
    const targetQuery = query || entity || topic || task || 'General Knowledge';
    console.log(`[DELEGATE] Coordinator -> Research Agent: "${targetQuery}"`);

    notifySubagent({
      name: 'research-agent',
      status: 'running',
      task: `Researching: ${targetQuery}`,
    });

    try {
      const result = await wikiTool.invoke({ query: targetQuery });
      const output = typeof result === 'string' ? result : JSON.stringify(result);
      const conciseOutput = output.length > 450 ? output.slice(0, 450) + '...' : output;

      notifySubagent({
        name: 'research-agent',
        status: 'completed',
        task: `Researching: ${targetQuery}`,
        output: conciseOutput.slice(0, 160),
      });

      return conciseOutput;
    } catch (err) {
      notifySubagent({
        name: 'research-agent',
        status: 'completed',
        task: `Researching: ${targetQuery}`,
        output: `Error: ${err.message}`,
      });
      return `Research Agent error: ${err.message}`;
    }
  },
  {
    name: 'delegate_to_research_agent',
    description:
      'Delegate encyclopedic research, historical facts, definitions, or city information to the specialized Research Agent.',
    schema: z
      .object({
        query: z.string().optional().describe('The entity, city, or topic to research (e.g. "Indore")'),
        task: z.string().optional().describe('Research context or questions'),
      })
      .passthrough(),
  }
);

// =========================================================================
// 2. UTILITY AGENT
// Specialized sub-agent handling weather, arithmetic calculations, and clock time
// =========================================================================
export const delegateToUtilityAgentTool = tool(
  async ({ task, city, calculation, operation, a, b }) => {
    let cleanTask = String(task || '');

    // Convert structured a/b/operation to calculation if passed
    if (a !== undefined && b !== undefined) {
      const op = operation === 'multiply' || operation === 'product'
        ? '*'
        : operation === 'add' || operation === 'sum'
        ? '+'
        : operation === 'subtract'
        ? '-'
        : operation === 'divide'
        ? '/'
        : '*';
      const mathStr = `${a} ${op} ${b}`;
      cleanTask = cleanTask ? `${cleanTask}, calculate ${mathStr}` : `calculate ${mathStr}`;
    }

    if (city && !cleanTask.toLowerCase().includes(String(city).toLowerCase())) {
      cleanTask = cleanTask ? `${cleanTask}, weather for ${city}` : `weather for ${city}`;
    }

    if (calculation && !cleanTask.includes(String(calculation))) {
      cleanTask = cleanTask ? `${cleanTask}, calculate ${calculation}` : `calculate ${calculation}`;
    }

    if (!cleanTask) {
      cleanTask = 'Utility tasks';
    }

    console.log(`[DELEGATE] Coordinator -> Utility Agent: "${cleanTask}"`);

    notifySubagent({
      name: 'utility-agent',
      status: 'running',
      task: cleanTask,
    });

    try {
      const results = [];

      // Check if weather mentioned
      if (city || /weather|mausam|temp|climate/i.test(cleanTask) || /\b(?:indore|delhi|mumbai|jaipur|bengaluru|bangalore|kolkata|chennai|pune|hyderabad)\b/i.test(cleanTask)) {
        const cityMatch = cleanTask.match(/(?:in|of|for|at)\s+([a-zA-Z\s]+?)(?:,|\.|\band\b|$)/i)?.[1]?.trim()
          || cleanTask.match(/\b(indore|delhi|mumbai|jaipur|bengaluru|bangalore|kolkata|chennai|pune|hyderabad)\b/i)?.[1]?.trim();
        const targetCity = city || cityMatch || 'Indore';
        try {
          const weatherRes = await weatherTool.invoke({ city: targetCity });
          results.push(`[Weather in ${targetCity}]: ${weatherRes}`);
        } catch (wErr) {
          results.push(`[Weather]: ${wErr.message}`);
        }
      }

      // Check if calculation mentioned
      const mathMatch = cleanTask.match(/(\d+(?:\.\d+)?)\s*([\*x×\+\-\/])\s*(\d+(?:\.\d+)?)/i);
      if (a !== undefined && b !== undefined) {
        const opName = operation === 'multiply' || operation === 'product' || operation === '*'
          ? 'multiply'
          : operation === 'subtract' || operation === '-'
          ? 'subtract'
          : operation === 'divide' || operation === '/'
          ? 'divide'
          : 'add';
        try {
          const calcRes = await calculatorTool.invoke({ a: Number(a), b: Number(b), operation: opName });
          results.push(`[Calculation]: ${calcRes}`);
        } catch (cErr) {
          results.push(`[Calculation]: ${cErr.message}`);
        }
      } else if (calculation || mathMatch) {
        const rawMath = String(calculation || mathMatch[0]);
        const m = rawMath.match(/(\d+(?:\.\d+)?)\s*([\*x×\+\-\/])\s*(\d+(?:\.\d+)?)/i);
        if (m) {
          const num1 = Number(m[1]);
          const symb = m[2];
          const num2 = Number(m[3]);
          const opName = (symb === '*' || symb === 'x' || symb === '×') ? 'multiply'
            : symb === '-' ? 'subtract'
            : symb === '/' ? 'divide'
            : 'add';
          try {
            const calcRes = await calculatorTool.invoke({ a: num1, b: num2, operation: opName });
            results.push(`[Calculation]: ${calcRes}`);
          } catch (cErr) {
            results.push(`[Calculation]: ${cErr.message}`);
          }
        }
      }

      // Check if time mentioned
      if (/\b(?:time|date|samay|clock)\b/i.test(cleanTask)) {
        try {
          const timeRes = await timeTool.invoke({});
          results.push(`[Time]: ${timeRes}`);
        } catch (tErr) {
          results.push(`[Time]: ${tErr.message}`);
        }
      }

      const output = results.length > 0 ? results.join('\n') : `Processed: ${cleanTask}`;
      const conciseOutput = output.length > 350 ? output.slice(0, 350) : output;

      notifySubagent({
        name: 'utility-agent',
        status: 'completed',
        task: cleanTask,
        output: conciseOutput.slice(0, 160),
      });

      return conciseOutput;
    } catch (err) {
      notifySubagent({
        name: 'utility-agent',
        status: 'completed',
        task: cleanTask,
        output: `Error: ${err.message}`,
      });
      return `Utility Agent error: ${err.message}`;
    }
  },
  {
    name: 'delegate_to_utility_agent',
    description:
      'Delegate weather lookups, arithmetic calculations, or clock time checks to the specialized Utility Agent.',
    schema: z
      .object({
        task: z.string().optional().describe('Utility task description (e.g. "Check current weather in Indore and calculate 25 * 4")'),
        city: z.string().optional().describe('City name for weather lookup (e.g. "Indore")'),
        calculation: z.string().optional().describe('Math expression to evaluate (e.g. "25 * 4")'),
        operation: z.string().optional().describe('Operation name (e.g. "multiply")'),
        a: z.number().optional().describe('First number'),
        b: z.number().optional().describe('Second number'),
      })
      .passthrough(),
  }
);

// =========================================================================
// 3. LEADS AGENT
// Specialized sub-agent handling business leads discovery and email reporting
// =========================================================================
export const delegateToLeadsAgentTool = tool(
  async ({ task, industry, location, query, sendEmail, recipientEmail }) => {
    let cleanInd = (industry || '').trim() || 'technology';
    let cleanLoc = (location || '').trim() || 'India';
    let shouldSend = Boolean(sendEmail);
    const to = (recipientEmail || '').trim() || 'mayanktesting144@gmail.com';

    if (task && (!industry || !location)) {
      const locMatch = task.match(/(?:in|at|near|for)\s+([a-zA-Z\s]+?)(?:$|\bcontact|\bemail|\bwith)/i);
      if (locMatch) {
        cleanLoc = locMatch[1].trim();
        cleanInd = task.replace(locMatch[0], '').replace(/top|best|\d+|companies|startups|leads/gi, '').trim() || cleanInd;
      }
      if (/email|send|dispatch/i.test(task)) {
        shouldSend = true;
      }
    }

    console.log(`[DELEGATE] Coordinator -> Leads Agent: "${cleanInd}" in "${cleanLoc}" (Send Email: ${shouldSend})`);

    notifySubagent({
      name: 'leads-agent',
      status: 'running',
      task: `Scouting leads for ${cleanInd} in ${cleanLoc}`,
    });

    try {
      const { fetchBusinessLeads } = await import('../tools/leadsTool.js');
      const { sendLeadsEmail } = await import('../tools/emailTool.js');

      const leads = await fetchBusinessLeads({ industry: cleanInd, location: cleanLoc, query });
      let emailNote = '';
      if (shouldSend) {
        const emailRes = await sendLeadsEmail(leads, to);
        if (emailRes.success) {
          emailNote = `\n\n> 📧 **Email Status:** Successfully delivered HTML leads report to \`${emailRes.recipient}\`.`;
        } else {
          emailNote = `\n\n> ⚠️ **Email Status:** ${emailRes.message}`;
        }
      }

      notifySubagent({
        name: 'leads-agent',
        status: 'completed',
        task: `Discovered 5 leads`,
        output: `5 verified leads found for ${cleanLoc}`,
      });

      return JSON.stringify(leads, null, 2) + emailNote;
    } catch (err) {
      notifySubagent({
        name: 'leads-agent',
        status: 'completed',
        task: `Leads discovery failed`,
        output: `Error: ${err.message}`,
      });
      return `Leads Agent error: ${err.message}`;
    }
  },
  {
    name: 'delegate_to_leads_agent',
    description:
      'Delegate discovering real business company leads, verified emails, phone numbers, and optional HTML email dispatch to the specialized Leads Agent.',
    schema: z
      .object({
        task: z.string().optional().describe('Leads scouting task description (e.g. "Find 5 AI software companies in Mumbai and send email")'),
        industry: z.string().optional().describe('Target industry or domain (e.g. "AI software")'),
        location: z.string().optional().describe('Target city or location (e.g. "Mumbai")'),
        query: z.string().optional().describe('Custom search query if industry and location are already combined'),
        sendEmail: z.boolean().optional().describe('Whether to dispatch the HTML report via email'),
        recipientEmail: z.string().optional().describe('Target email address (defaults to mayanktesting144@gmail.com)'),
      })
      .passthrough(),
  }
);

/**
 * Subagent delegation tools array exported for the coordinator.
 */
export const subagentDelegationTools = [
  delegateToResearchAgentTool,
  delegateToUtilityAgentTool,
  delegateToLeadsAgentTool,
];

export default {
  setSubagentEventListener,
  delegateToResearchAgentTool,
  delegateToUtilityAgentTool,
  delegateToLeadsAgentTool,
  subagentDelegationTools,
};
