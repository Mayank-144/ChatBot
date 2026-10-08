import { ChatGroq } from '@langchain/groq';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getSessionHistory, recordTurn, getSessionMessages } from './memory.js';

/**
 * Default System Prompt defining agent behavior, persona, and tool usage rules.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Mayank AI, an intelligent, modern, and helpful fullstack AI assistant.
You have access to a set of real-time tools: get_weather (for weather reports), wikipedia_search (for Wikipedia knowledge and definitions), calculator (MCP arithmetic), and get_time (MCP real-time clock).

Guidelines:
1. Always invoke tools proactively whenever external info is requested:
   - For weather (even with typos or Hindi/Hinglish phrases like "ujjianu weather", "delhi ka mausam", "mumbai temp"), extract the intended city (e.g., "Ujjain", "Delhi", "Mumbai") and call get_weather.
   - For factual/knowledge questions (e.g., "taj mahakal kya h", "who was Alan Turing", "Newton ke bare mein batao"), clean the query and call wikipedia_search.
   - For math questions (e.g., "2+5", "25*4"), call calculator.
   - For time/date questions, call get_time.
2. For math calculations, present the final answer simply and clearly in standard natural text (e.g. "2 + 5 = 7" or "2 + 50 = 52"). Never output raw LaTeX syntax like \\mathbf{}.
3. Respond in the language used by the user (Hindi, English, or Hinglish).
4. Maintain conversation context and recall information shared earlier by the user.`;

/**
 * Creates and configures a LangChain ChatGroq model instance.
 * @param {Object} [options]
 * @param {string} [options.apiKey]
 * @param {string} [options.modelName]
 * @param {number} [options.temperature]
 * @returns {ChatGroq}
 */
export function getGroqModel(options = {}) {
  const apiKey = options.apiKey || process.env.GROQ_API_KEY || process.env.VITE_API_KEY;
  const modelName = options.modelName || process.env.GROQ_MODEL || process.env.VITE_MODEL || 'llama-3.3-70b-versatile';
  const temperature = options.temperature ?? 0.3;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured. Please provide an API key in your .env file.');
  }

  return new ChatGroq({
    apiKey,
    model: modelName,
    temperature,
  });
}

/**
 * Builds a runnable LangChain React Agent with the provided tools.
 * @param {Object} params
 * @param {Array} params.tools - Array of LangChain tools
 * @param {string} [params.systemPrompt]
 * @param {ChatGroq} [params.model]
 * @returns {any} Runnable agent executor
 */
export function createChatAgent({ tools = [], systemPrompt = DEFAULT_SYSTEM_PROMPT, model = null }) {
  const llm = model || getGroqModel();
  
  return createReactAgent({
    llm,
    tools,
    messageModifier: new SystemMessage(systemPrompt),
  });
}

/**
 * Execute the agent with session memory and streaming callbacks.
 * @param {Object} params
 * @param {string} params.input - User's current prompt
 * @param {string} [params.sessionId='default'] - Session ID for memory
 * @param {Array} [params.tools=[]] - Available tools
 * @param {Function} [params.onToken] - Streaming token callback (chunk)
 * @param {Function} [params.onToolStart] - Tool execution started callback ({ name, input })
 * @param {Function} [params.onToolEnd] - Tool execution finished callback ({ name, output })
 * @returns {Promise<{ output: string, toolCalls: Array }>}
 */
export async function runAgent({
  input,
  sessionId = 'default',
  tools = [],
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  model = null,
  onToken = null,
  onToolStart = null,
  onToolEnd = null,
}) {
  const agent = createChatAgent({ tools, systemPrompt, model });
  const rawPastMessages = await getSessionMessages(sessionId);
  // Keep last 6 messages for token efficiency on free-tier limits
  const pastMessages = rawPastMessages.slice(-6);

  const messages = [
    ...pastMessages,
    new HumanMessage(input),
  ];

  const toolCalls = [];
  let finalContent = '';

  // Stream agent events (token streaming, tool invocations)
  const eventStream = await agent.streamEvents(
    { messages },
    { version: 'v2' }
  );

  for await (const event of eventStream) {
    const eventType = event.event;

    // Handle tool start
    if (eventType === 'on_tool_start') {
      const toolData = {
        name: event.name,
        input: event.data?.input,
      };
      toolCalls.push(toolData);
      if (onToolStart) {
        onToolStart(toolData);
      }
    }

    // Handle tool end
    if (eventType === 'on_tool_end') {
      const toolData = {
        name: event.name,
        output: event.data?.output,
      };
      if (onToolEnd) {
        onToolEnd(toolData);
      }
    }

    // Handle LLM streaming tokens
    if (eventType === 'on_chat_model_stream') {
      const chunk = event.data?.chunk?.text || event.data?.chunk?.content;
      if (chunk && typeof chunk === 'string') {
        finalContent += chunk;
        if (onToken) {
          onToken(chunk);
        }
      }
    }
  }

  // If finalContent is still empty (e.g. from state graph final message), extract from final state
  if (!finalContent) {
    const finalState = await agent.invoke({ messages });
    const lastMsg = finalState.messages[finalState.messages.length - 1];
    finalContent = typeof lastMsg?.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg?.content || '');
  }

  // Save interaction to session memory
  await recordTurn(sessionId, input, finalContent);

  return {
    output: finalContent,
    toolCalls,
  };
}
