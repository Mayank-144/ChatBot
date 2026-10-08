import { weatherTool } from './weatherTool.js';
import { wikiTool } from './wikiTool.js';
import { calculatorTool, setMcpClient } from './calculatorTool.js';
import { timeTool } from './timeTool.js';

/**
 * Array of all active LangChain agent tools.
 */
export const agentTools = [
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
];

export {
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  setMcpClient,
};

export default agentTools;
