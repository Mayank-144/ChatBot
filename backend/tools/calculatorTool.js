import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Shared MCP Client reference for tool execution.
 */
let sharedMcpClient = null;

/**
 * Set an externally managed MCP client instance (e.g., from backend/index.js).
 * @param {Client} client
 */
export function setMcpClient(client) {
  sharedMcpClient = client;
}

/**
 * Get or lazily initialize the MCP client connection to mcp-server.
 * @returns {Promise<Client>}
 */
export async function getOrInitMcpClient() {
  if (sharedMcpClient) {
    return sharedMcpClient;
  }

  const mcpServerPath = path.resolve(__dirname, '../../mcp-server/index.js');
  const transport = new StdioClientTransport({
    command: 'node',
    args: [mcpServerPath],
  });

  const client = new Client(
    { name: 'langchain-mcp-calculator-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  sharedMcpClient = client;
  return sharedMcpClient;
}

/**
 * Zod schema matching MCP Calculator input parameters.
 */
const calculatorSchema = z.object({
  a: z.number().describe('The first number in the arithmetic calculation'),
  b: z.number().describe('The second number in the arithmetic calculation'),
  operation: z
    .enum(['add', 'subtract', 'multiply', 'divide'])
    .describe('The mathematical operation to perform: "add", "subtract", "multiply", or "divide"'),
});

/**
 * Execute calculation by delegating strictly to the MCP Server tool.
 * No duplicate calculation logic is implemented here.
 * @param {Object} input - { a: number, b: number, operation: string }
 * @returns {Promise<string>}
 */
async function executeMcpCalculator({ a, b, operation }) {
  try {
    const client = await getOrInitMcpClient();
    const result = await client.callTool({
      name: 'calculator',
      arguments: { a, b, operation },
    });

    if (result.isError) {
      const errorText = result.content?.[0]?.text || 'MCP Calculator returned an error.';
      return `Calculator Error: ${errorText}`;
    }

    const outputText = result.content?.[0]?.text || JSON.stringify(result);
    return outputText;
  } catch (error) {
    return `Failed to execute MCP calculator tool: ${error.message}`;
  }
}

/**
 * LangChain Calculator Tool that wraps the official Model Context Protocol (MCP) server.
 */
export const calculatorTool = tool(executeMcpCalculator, {
  name: 'calculator',
  description:
    'Performs exact mathematical operations (add, subtract, multiply, divide) by delegating to the high-precision Model Context Protocol (MCP) calculator tool.',
  schema: calculatorSchema,
});

export default calculatorTool;
