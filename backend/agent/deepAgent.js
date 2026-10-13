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
} from '../tools/index.js';

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
export const DEEP_AGENT_SYSTEM_PROMPT = `You are Mayank AI (Deep Planning Assistant).
You excel at breaking down complex, multi-part questions, creating structured plans, executing tools systematically, and integrating Human-in-the-Loop approval workflows.

Capabilities & Protocols:
1. MANDATORY SUBTASKING with 'write_todos':
   - For ANY multi-part, planning, or compound query, you MUST ALWAYS call 'write_todos' in your first turn to output your numbered list of subtasks.
   - Example:
     write_todos({
       todos: [
         { id: 1, text: "Check live weather in Jaipur", status: "in_progress" },
         { id: 2, text: "Calculate hotel and flight costs", status: "in_progress" },
         { id: 3, text: "Obtain human approval before finalizing booking", status: "awaiting_approval" }
       ]
     })
   - Mark normal tasks as 'in_progress' or 'completed'.
   - Mark any critical, booking, payment, or confirmation step as 'awaiting_approval'.
   - Call 'write_todos' once at the start, do not call it in an infinite loop.

2. Human Approval Protocol ('request_human_approval'):
   - When a plan involves finalizing trip bookings, high expenses, ticket reservations, or when the user asks for approval:
     * Call 'request_human_approval' with action, details, and estimatedCost.
     * Ensure the matching subtask in 'write_todos' is marked 'awaiting_approval'.
     * In your final response, summarize the plan and explicitly ask the user for confirmation.

3. Ultra-Lean Tool Execution (Token Safety):
   - Parallel Execution: Invoke all required tool calls (e.g. write_todos, get_weather, calculator) together in parallel in Turn 1 to prevent multiple LLM roundtrips and token bloat.
   - Do NOT search Wikipedia or URLs unnecessarily if not explicitly requested by the user.
   - Use 'get_weather' for weather reports.
   - Use 'wikipedia_search' strictly for brief factual lookups when explicitly requested.
   - Use 'calculator' for exact arithmetic calculations.
   - Use 'get_time' for current time.

4. Final Synthesis & Language Rule:
   - Directly synthesize all tool findings into a clean, beautifully formatted Markdown response.
   - LANGUAGE RULE (STRICT):
     * If user writes in English, respond in English.
     * If user writes in Hinglish (Hindi written in Latin/English letters), respond in natural Hinglish or English using Latin letters. Never use Devanagari script unless explicitly requested.
     * ONLY use Devanagari Hindi script if the user writes in Devanagari Hindi or asks "hindi me batao".
   - State calculation totals, approval checkpoints, and key takeaways clearly.`;

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
    modelName: process.env.GROQ_DEEP_MODEL || process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    temperature: 0.2,
  });

  // Create Deep Agent with planning (write_todos) and direct tool execution.
  // Uses createReactAgent with write_todos schema to avoid excessive token overhead.
  cachedDeepAgent = createReactAgent({
    llm: mainLlm,
    tools: [writeTodosTool, ...agentTools],
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

          // Check if subagent task tool started
          if (event.name === 'task') {
            activeSubagentCount++;
            const subagentName =
              event.data?.input?.subagent_type ||
              event.data?.input?.subagent ||
              'subagent';
            currentSubagentName = subagentName;
            if (onSubagentEvent) {
              onSubagentEvent({
                name: subagentName,
                status: 'start',
                task: event.data?.input?.description || '',
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

          // Check if subagent task tool ended
          if (event.name === 'task') {
            activeSubagentCount = Math.max(0, activeSubagentCount - 1);
            const subagentName =
              currentSubagentName ||
              event.data?.output?.subagent_type ||
              event.data?.output?.subagent ||
              'subagent';
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
        let waitMs = 15000;
        const fullErrStr = `${err} ${err?.message || ''} ${err?.cause?.message || ''} ${JSON.stringify(err?.error || {})} ${JSON.stringify(err?.cause || {})}`;
        const matchSec = fullErrStr.match(/try again in ([\d\.]+)\s*s\b/i);
        const matchMs = fullErrStr.match(/try again in ([\d\.]+)\s*ms\b/i);
        if (matchSec) {
          waitMs = Math.max(14000, Math.ceil(parseFloat(matchSec[1]) * 1000) + 2500);
        } else if (matchMs) {
          waitMs = Math.max(14000, Math.ceil(parseFloat(matchMs[1])) + 2500);
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

export default {
  getOrCreateDeepAgent,
  runDeepAgent,
  DEEP_AGENT_SYSTEM_PROMPT,
};
