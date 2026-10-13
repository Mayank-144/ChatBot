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
      if (city || /weather|mausam|temp|climate/i.test(cleanTask) || /indore|delhi|mumbai|jaipur/i.test(cleanTask)) {
        const targetCity = city || cleanTask.match(/(?:in|of|for|at)\s+([a-zA-Z\s]+?)(?:,|\.|\band\b|$)/i)?.[1]?.trim() || (/indore/i.test(cleanTask) ? 'Indore' : 'Indore');
        try {
          const weatherRes = await weatherTool.invoke({ city: targetCity });
          results.push(`[Weather in ${targetCity}]: ${weatherRes}`);
        } catch (wErr) {
          results.push(`[Weather]: ${wErr.message}`);
        }
      }

      // Check if calculation mentioned
      const mathMatch = cleanTask.match(/\d+\s*[\*x×\+\-\/]\s*\d+/i) || cleanTask.match(/([\d\s\+\-\*\/\×\÷\.\(\)]+(?:[\+\-\*\/\×\÷][\d\s\+\-\*\/\×\÷\.\(\)]+)+)/);
      if (calculation || mathMatch) {
        const rawMath = String(calculation || mathMatch[0]);
        try {
          const calcRes = await calculatorTool.invoke({ expression: rawMath });
          results.push(`[Calculation]: ${rawMath.trim()} = ${calcRes}`);
        } catch (cErr) {
          results.push(`[Calculation]: ${cErr.message}`);
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

/**
 * Subagent delegation tools array exported for the coordinator.
 */
export const subagentDelegationTools = [
  delegateToResearchAgentTool,
  delegateToUtilityAgentTool,
];

export default {
  setSubagentEventListener,
  delegateToResearchAgentTool,
  delegateToUtilityAgentTool,
  subagentDelegationTools,
};
