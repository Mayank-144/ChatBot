import { createDeepAgent, StateBackend } from 'deepagents';
import { HumanMessage } from '@langchain/core/messages';
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
 * Deep Agent System Prompt defining planning, delegation, and reasoning behavior.
 */
export const DEEP_AGENT_SYSTEM_PROMPT = `You are Mayank AI (Deep Planning Assistant), an intelligent, autonomous multi-step reasoning agent.
You excel at breaking down complex, multi-part questions and executing them systematically.

Capabilities & Protocols:
1. Planning with 'write_todos':
   - For multi-step questions (e.g. comparing multiple items, step-by-step problem solving, compound workflows), immediately use 'write_todos' to create an actionable, numbered plan of tasks.
   - Keep todos clear, specific, and trackable.
   - Update todos as you make progress and finish subtasks.

2. Delegation with Subagents via 'task' tool:
   - 'research-agent': Delegate all external Wikipedia lookups, general facts, definitions, and weather reports to this specialist.
   - 'math-time-agent': Delegate mathematical calculations, arithmetic expressions, and real-time clock queries to this specialist.
   - Avoid doing work sequentially by yourself when subagents can handle specialist domains in isolated context.

3. Final Synthesis:
   - Combine all subtask findings into a clean, well-formatted, natural language response.
   - Respond in the language used by the user (Hindi, English, or Hinglish).
   - If mathematical calculations were performed, state final numbers clearly without raw LaTeX formatting.`;

/**
 * Normalizes raw todo input/output into a structured, predictable format:
 * [{ id: number, text: string, status: 'pending' | 'in_progress' | 'completed' }]
 */
export function normalizeTodos(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.todos)
    ? raw.todos
    : [raw];

  return list.map((item, idx) => {
    if (typeof item === 'string') {
      return {
        id: idx + 1,
        text: item.trim(),
        status: 'pending',
      };
    }

    let status = 'pending';
    const rawStatus = String(item.status || '').toLowerCase();
    if (['completed', 'done', 'finished', 'true'].includes(rawStatus) || item.completed === true) {
      status = 'completed';
    } else if (['in_progress', 'doing', 'running', 'active'].includes(rawStatus)) {
      status = 'in_progress';
    }

    return {
      id: item.id || idx + 1,
      text: item.text || item.title || item.task || item.description || `Step ${idx + 1}`,
      status,
    };
  });
}

/**
 * Subagent definitions with isolated tools and specialized prompts.
 */
export function createSubagentSpecs() {
  const subagentLlm = getGroqModel({
    modelName: process.env.GROQ_SUBAGENT_MODEL || process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
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
    modelName: process.env.GROQ_DEEP_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.2,
  });

  const subagents = createSubagentSpecs();

  // Create Deep Agent using StateBackend (virtual in-memory filesystem, zero real disk/shell access)
  cachedDeepAgent = createDeepAgent({
    model: mainLlm,
    systemPrompt: DEEP_AGENT_SYSTEM_PROMPT,
    tools: agentTools,
    subagents,
    backend: new StateBackend(),
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
  onToolStart = null,
  onToolEnd = null,
  onTodoUpdate = null,
  onSubagentEvent = null,
  recursionLimit = 25,
}) {
  const agent = getOrCreateDeepAgent();
  const rawPastMessages = await getSessionMessages(sessionId);
  const pastMessages = rawPastMessages.slice(-6);

  const messages = [
    ...pastMessages,
    new HumanMessage(input),
  ];

  const toolCalls = [];
  let finalContent = '';
  let fallbackContent = '';
  let activeSubagentCount = 0;
  let currentSubagentName = null;

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
      if (onToolStart) {
        onToolStart(toolData);
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

      // Check if planning write_todos tool started
      if (event.name === 'write_todos' && onTodoUpdate) {
        const rawTodos = event.data?.input?.todos || event.data?.input;
        if (rawTodos) {
          onTodoUpdate(normalizeTodos(rawTodos));
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
      if (event.name === 'write_todos' && onTodoUpdate) {
        const rawTodos = event.data?.output?.todos || event.data?.output;
        if (rawTodos) {
          onTodoUpdate(normalizeTodos(rawTodos));
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
              if (onToken) {
                onToken(cleanChunk);
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

  // Safe fallback if streaming chunks were buffered
  if (!finalContent && fallbackContent) {
    finalContent = fallbackContent;
    if (onToken) {
      onToken(finalContent);
    }
  }

  if (!finalContent) {
    finalContent = 'I processed your multi-step request, but no additional response was generated.';
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
