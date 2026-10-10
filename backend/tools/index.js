import { weatherTool } from './weatherTool.js';
import { wikiTool } from './wikiTool.js';
import { calculatorTool, setMcpClient } from './calculatorTool.js';
import { timeTool } from './timeTool.js';
import { searchDocumentsTool } from './searchDocumentsTool.js';

/**
 * Array of all active LangChain agent tools.
 */
export const agentTools = [
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  searchDocumentsTool,
];

export {
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  searchDocumentsTool,
  setMcpClient,
};

export default agentTools;
