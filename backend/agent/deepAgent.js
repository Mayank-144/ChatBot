import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { getGroqModel } from './index.js';
import { getSessionMessages, recordTurn } from './memory.js';
import {
  agentTools,
  weatherTool,
  wikiTool,
  calculatorTool,
  timeTool,
  sendEmailTool,
  prepareEmailTool,
} from '../tools/index.js';
import {
  subagentDelegationTools,
  setSubagentEventListener,
} from './subagents.js';
import { approvalContext } from './approvalManager.js';

/**
 * Zod schema and LangChain tool for write_todos task planning.
 */
const writeTodosSchema = z.object({
  todos: z.array(
    z.object({
      id: z.union([z.number(), z.string()]).optional(),
      text: z.string().describe('Description of the task step'),
      status: z.string().optional().default('pending'),
    })
  ).describe('List of task items representing plan steps and progress'),
});

export const writeTodosTool = tool(
  async ({ todos }) => {
    return JSON.stringify({
      status: 'plan_recorded',
      count: todos?.length || 0,
    });
  },
  {
    name: 'write_todos',
    description: 'Create, update, or track a list of step-by-step tasks (todos) to execute complex, multi-step queries systematically.',
    schema: writeTodosSchema,
  }
);

/**
 * Deep Agent System Prompt defining planning, delegation, and reasoning behavior.
 */
export const DEEP_AGENT_SYSTEM_PROMPT = `You are Mayank AI, a Master Deep Planning Coordinator.
You orchestrate complex goals: analyze requests, formulate structured execution plans with 'write_todos', delegate subtasks to specialized sub-agents, pause for Human-in-the-Loop (HITL) approval, and synthesize the final response.

Execution Protocols:
1. INITIAL PLANNING & BATCH DELEGATION (Turn 1):
   - In your very first turn, establish your plan and dispatch tasks to specialized subagents together:
     * Call 'write_todos' with the subtasks checklist:
       [{ id: 1, text: "Research Indore information via Research Agent", status: "in_progress" },
        { id: 2, text: "Check weather and calculate 25 × 4 via Utility Agent", status: "in_progress" },
        { id: 3, text: "Draft email summary via Communication Agent", status: "in_progress" },
        { id: 4, text: "Human Approval: Send email with summary", status: "awaiting_approval" }]
     * Call 'delegate_to_research_agent' with { query: "Indore" }
     * Call 'delegate_to_utility_agent' with { task: "Check weather in Indore and calculate 25 * 4" }

2. DRAFT & HITL HUMAN APPROVAL (Turn 2):
   - With findings gathered from Research and Utility agents:
     * Call 'delegate_to_communication_agent' with { to: "team@example.com", subject: "Indore Summary & Report", body: "..." }
     * Call 'send_email' with { to: "team@example.com", subject: "Indore Summary & Report", body: "..." }
   - 'send_email' is a sensitive action that automatically PAUSES backend execution and requests explicit human approval (Approve or Reject).

3. FINAL SYNTHESIS:
   - Provide a clean, well-formatted Markdown report of all findings (Indore facts, weather, math calculation, and email approval status).
   - If user writes in English, reply in English.
   - If user writes in Hinglish, reply in natural Hinglish or English using Latin letters. Never reply in Devanagari Hindi unless asked.`;

/**
 * Normalizes raw todo input/output into a structured, predictable format:
 * [{ id: number, text: string, status: 'pending' | 'in_progress' | 'completed' | 'awaiting_approval' }]
 */
export function normalizeTodos(raw) {
  if (!raw) return [];
  if (raw && typeof raw.content === 'string') {
    raw = raw.content;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed) raw = parsed;
    } catch {}
  }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.todos)
    ? raw.todos
    : Array.isArray(raw?.content?.todos)
    ? raw.content.todos
    : [raw];

  return list
    .map((item, idx) => {
      if (typeof item === 'string') {
        try {
          const parsed = JSON.parse(item);
          if (parsed && typeof parsed === 'object') {
            const nested = normalizeTodos(parsed);
            if (nested.length > 0) return nested[0];
          }
        } catch {}
        return {
          id: idx + 1,
          text: item.trim(),
          status: 'pending',
        };
      }

      let status = 'pending';
      const rawStatus = String(item?.status || '').toLowerCase();
      if (['completed', 'done', 'finished', 'true'].includes(rawStatus) || item?.completed === true) {
        status = 'completed';
      } else if (['awaiting_approval', 'approval_required', 'needs_approval', 'approval'].includes(rawStatus)) {
        status = 'awaiting_approval';
      } else if (['in_progress', 'doing', 'running', 'active'].includes(rawStatus)) {
        status = 'in_progress';
      }

      return {
        id: item?.id || idx + 1,
        text: item?.text || item?.title || item?.task || item?.description || `Step ${idx + 1}`,
        status,
      };
    })
    .filter(Boolean);
}

/**
 * Subagent definitions with isolated tools and specialized prompts.
 */
export function createSubagentSpecs() {
  const subagentLlm = getGroqModel({
    modelName: process.env.GROQ_SUBAGENT_MODEL || process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    temperature: 0.1,
  });

  return [
    {
      name: 'research-agent',
      description:
        'Specialist subagent for researching Wikipedia encyclopedic facts, definitions, concepts, and live weather conditions across cities.',
      systemPrompt:
        'You are a research specialist. You have access to wikipedia_search and get_weather. Research the requested query thoroughly, synthesize the facts concisely, and report the results back.',
      tools: [wikiTool, weatherTool],
      model: subagentLlm,
    },
    {
      name: 'math-time-agent',
      description:
        'Specialist subagent for exact mathematical calculations, arithmetic expressions, and real-time clock time/date queries.',
      systemPrompt:
        'You are a calculation and time specialist. You have access to calculator and get_time. Compute mathematical questions accurately and fetch real-time clock timestamps.',
      tools: [calculatorTool, timeTool],
      model: subagentLlm,
    },
  ];
}

// Module-level cached Deep Agent instance
let cachedDeepAgent = null;

/**
 * Builds or retrieves the compiled LangGraph Deep Agent instance.
 * @returns {any} Runnable Deep Agent
 */
export function getOrCreateDeepAgent() {
  if (cachedDeepAgent) {
    return cachedDeepAgent;
  }

  const mainLlm = getGroqModel({
    modelName: process.env.GROQ_DEEP_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.2,
  });

  // Tools available to the Main Deep Agent coordinator:
  // Planning (write_todos) + Specialized Sub-Agent Delegation + HITL actions (send_email)
  cachedDeepAgent = createReactAgent({
    llm: mainLlm,
    tools: [
      writeTodosTool,
      ...subagentDelegationTools,
      sendEmailTool,
    ],
    messageModifier: new SystemMessage(DEEP_AGENT_SYSTEM_PROMPT),
  });

  return cachedDeepAgent;
}

/**
 * Executes the Deep Agent with planning, subagent delegation, and event streaming.
 * Filters subagent internal tokens so only the main agent coordinator's final answer is streamed.
 *
 * @param {Object} params
 * @param {string} params.input - User query
 * @param {string} [params.sessionId='default'] - Session ID for memory
 * @param {Function} [params.onToken] - Stream token callback (only final answer)
 * @param {Function} [params.onToolStart] - Tool execution started callback
 * @param {Function} [params.onToolEnd] - Tool execution finished callback
 * @param {Function} [params.onTodoUpdate] - Live todo list update callback
 * @param {Function} [params.onSubagentEvent] - Subagent { name, status, task } callback
 * @param {number} [params.recursionLimit=25] - Max recursion steps to prevent infinite loops
 * @returns {Promise<{ output: string, toolCalls: Array }>}
 */
export async function runDeepAgent({
  input,
  sessionId = 'default',
  onToken = null,
  onChunk = null,
  onToolStart = null,
  onToolCall = null,
  onToolEnd = null,
  onTodoUpdate = null,
  onTodos = null,
  onSubagentEvent = null,
  onApprovalRequest = null,
  recursionLimit = 25,
}) {
  return approvalContext.run(
    { sessionId, onApprovalRequest },
    async () => {
      if (onSubagentEvent) {
        setSubagentEventListener(onSubagentEvent);
      }

      const notifyToken = onToken || onChunk;
      const notifyToolStart = onToolStart || onToolCall;
      const notifyTodoUpdate = onTodoUpdate || onTodos;
      const agent = getOrCreateDeepAgent();
  const rawPastMessages = await getSessionMessages(sessionId);
  const pastMessages = rawPastMessages.slice(-2).map((m) => {
    if (typeof m.content === 'string' && m.content.length > 350) {
      return new AIMessage(m.content.slice(0, 350) + '...');
    }
    return m;
  });

  const inputContent = typeof input === 'string'
    ? input
    : (input?.content || (Array.isArray(input) ? input[input.length - 1]?.content : String(input || '')));

  const messages = [
    ...pastMessages,
    new HumanMessage(inputContent),
  ];

  const toolCalls = [];
  let finalContent = '';
  let fallbackContent = '';
  let latestTodos = [];
  let activeSubagentCount = 0;
  let currentSubagentName = null;

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      toolCalls.length = 0;
      finalContent = '';
      fallbackContent = '';
      activeSubagentCount = 0;
      currentSubagentName = null;

      // Stream agent events with strict recursionLimit to prevent infinite loops
      const eventStream = await agent.streamEvents(
        { messages },
        {
          version: 'v2',
          recursionLimit: recursionLimit || 25,
        }
      );

      for await (const event of eventStream) {
        const eventType = event.event;

        // Handle tool invocations (write_todos, task, weather, wiki, calculator, time)
        if (eventType === 'on_tool_start') {
          const toolData = {
            name: event.name,
            input: event.data?.input,
          };
          toolCalls.push(toolData);

          // Notify tool start (for tool badge events in UI)
          if (notifyToolStart) {
            notifyToolStart(toolData);
          }

          // Check if subagent task tool or delegation tool started
          if (event.name === 'task' || event.name.startsWith('delegate_to_')) {
            activeSubagentCount++;
            const subagentName = event.name.startsWith('delegate_to_')
              ? event.name.replace('delegate_to_', '').replace(/_/g, '-')
              : (event.data?.input?.subagent_type || event.data?.input?.subagent || 'subagent');
            currentSubagentName = subagentName;
            if (onSubagentEvent) {
              onSubagentEvent({
                name: subagentName,
                status: 'running',
                task: event.data?.input?.task || event.data?.input?.description || '',
              });
            }
          }

          // Check if human approval tool started
          if (event.name === 'request_human_approval' && onApprovalRequest) {
            onApprovalRequest(event.data?.input);
          }

          // Check if planning write_todos tool started
          if (event.name === 'write_todos' && notifyTodoUpdate) {
            const rawTodos = event.data?.input?.todos || event.data?.input;
            if (rawTodos) {
              latestTodos = normalizeTodos(rawTodos);
              notifyTodoUpdate(latestTodos);
            }
          }
        }

        if (eventType === 'on_tool_end') {
          const toolData = {
            name: event.name,
            output: event.data?.output,
          };

          if (onToolEnd) {
            onToolEnd(toolData);
          }

          // Check if subagent task tool or delegation tool ended
          if (event.name === 'task' || event.name.startsWith('delegate_to_')) {
            activeSubagentCount = Math.max(0, activeSubagentCount - 1);
            const subagentName =
              currentSubagentName ||
              (event.name.startsWith('delegate_to_')
                ? event.name.replace('delegate_to_', '').replace(/_/g, '-')
                : 'subagent');
            if (onSubagentEvent) {
              onSubagentEvent({
                name: subagentName,
                status: 'completed',
              });
            }
            currentSubagentName = null;
          }

          // Check if write_todos produced an updated todo list
          if (event.name === 'write_todos' && notifyTodoUpdate) {
            const rawTodos = event.data?.output?.todos;
            if (Array.isArray(rawTodos) && rawTodos.length > 0) {
              latestTodos = normalizeTodos(rawTodos);
              notifyTodoUpdate(latestTodos);
            }
          }
        }

        // Handle LLM streaming tokens:
        // FILTER: Only stream tokens from the main agent coordinator when activeSubagentCount === 0.
        // Filter out internal tokens from subagent runs so user chat doesn't receive garbled fragments.
        if (eventType === 'on_chat_model_stream') {
          if (activeSubagentCount === 0) {
            const isToolCallChunk =
              Array.isArray(event.data?.chunk?.tool_call_chunks) &&
              event.data.chunk.tool_call_chunks.length > 0;

            if (!isToolCallChunk) {
              const rawChunk = event.data?.chunk?.text || event.data?.chunk?.content;
              if (rawChunk && typeof rawChunk === 'string') {
                const cleanChunk = rawChunk.replace(/<\|.*?\|>/g, '');
                if (cleanChunk) {
                  finalContent += cleanChunk;
                  if (notifyToken) {
                    notifyToken(cleanChunk);
                  }
                }
              }
            }
          }
        }

        // Safe fallback extraction from stream events if tokens were buffered
        if (eventType === 'on_chat_model_end' && activeSubagentCount === 0) {
          const text = event.data?.output?.generations?.[0]?.[0]?.text || event.data?.output?.content;
          if (text && typeof text === 'string') {
            fallbackContent = text.replace(/<\|.*?\|>/g, '');
          }
        } else if (eventType === 'on_chain_end' && event.name === 'LangGraph') {
          const msgs = event.data?.output?.messages;
          if (Array.isArray(msgs) && msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            if (lastMsg?.content) {
              const contentStr =
                typeof lastMsg.content === 'string'
                  ? lastMsg.content
                  : JSON.stringify(lastMsg.content);
              fallbackContent = contentStr.replace(/<\|.*?\|>/g, '');
            }
          }
        }
      }

      break; // Execution succeeded, break retry loop
    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('Rate limit') ||
        err?.message?.includes('rate_limit_exceeded') ||
        err?.cause?.message?.includes('429');

      if (isRateLimit && attempt < maxAttempts) {
        let waitMs = 45000;
        const fullErrStr = `${err} ${err?.message || ''} ${err?.cause?.message || ''} ${JSON.stringify(err?.error || {})} ${JSON.stringify(err?.cause || {})}`;
        const matchSec = fullErrStr.match(/try again in ([\d\.]+)\s*s\b/i);
        const matchMs = fullErrStr.match(/try again in ([\d\.]+)\s*ms\b/i);
        if (matchSec) {
          waitMs = Math.max(45000, Math.ceil(parseFloat(matchSec[1]) * 1000) + 3000);
        } else if (matchMs) {
          waitMs = Math.max(45000, Math.ceil(parseFloat(matchMs[1])) + 3000);
        }
        console.warn(`⏳ Groq 429 rate limit (attempt ${attempt}/${maxAttempts}): ${err?.message || ''}. Backing off ${waitMs}ms before retry...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }

  // Safe fallback if streaming chunks were buffered
  if (!finalContent && fallbackContent) {
    finalContent = fallbackContent;
    if (notifyToken) {
      notifyToken(finalContent);
    }
  }

  if (!finalContent) {
    finalContent = 'I processed your multi-step request, but no additional response was generated.';
  }

  // Finalize all planned tasks as completed (while preserving awaiting_approval items for human review)
  if (latestTodos && latestTodos.length > 0 && onTodoUpdate) {
    const finalized = latestTodos.map((t) => ({
      ...t,
      status: t.status === 'awaiting_approval' ? 'awaiting_approval' : 'completed',
    }));
    onTodoUpdate(finalized);
  }

    // Record completed turn into session memory
    await recordTurn(sessionId, input, finalContent);

    return {
      output: finalContent,
      toolCalls,
    };
  }
  );
}

export default {
  getOrCreateDeepAgent,
  runDeepAgent,
  DEEP_AGENT_SYSTEM_PROMPT,
};
