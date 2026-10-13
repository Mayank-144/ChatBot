import { weatherTool } from './weatherTool.js';
import { wikiTool } from './wikiTool.js';
import { calculatorTool, setMcpClient } from './calculatorTool.js';
import { timeTool } from './timeTool.js';
import { requestHumanApprovalTool } from './approvalTool.js';

/**
 * Array of all active LangChain agent tools.
 */
export const agentTools = [
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  requestHumanApprovalTool,
];

export {
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  requestHumanApprovalTool,
  setMcpClient,
};

export default agentTools;
