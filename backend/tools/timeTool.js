import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getOrInitMcpClient } from './calculatorTool.js';

/**
 * Zod schema for time tool (no required parameters).
 */
const timeSchema = z.object({});

/**
 * Execute get_time by delegating strictly to the MCP Server tool.
 * @returns {Promise<string>}
 */
async function executeMcpGetTime() {
  try {
    const client = await getOrInitMcpClient();
    const result = await client.callTool({
      name: 'get_time',
      arguments: {},
    });

    const outputText = result.content?.[0]?.text || JSON.stringify(result);
    return outputText;
  } catch (error) {
    const now = new Date();
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString(),
      timestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      source: 'fallback',
    });
  }
}

/**
 * LangChain Time Tool that wraps the official MCP server get_time tool.
 */
export const timeTool = tool(executeMcpGetTime, {
  name: 'get_time',
  description:
    'Returns the current exact date, time, and timezone by delegating to the Model Context Protocol (MCP) time tool.',
  schema: timeSchema,
});

export default timeTool;
