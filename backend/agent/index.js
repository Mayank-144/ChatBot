import { ChatGroq } from '@langchain/groq';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getSessionHistory, recordTurn, getSessionMessages } from './memory.js';

/**
 * Default System Prompt defining agent behavior, persona, and tool usage rules.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are Mayank AI, an intelligent, modern, and helpful fullstack AI assistant.
You have access to a set of real-time tools including weather lookup, Wikipedia search, and a high-precision MCP calculator.

Guidelines:
1. Use tools whenever you need current real-world facts, accurate calculations, or external data.
2. If asked about current time, weather, or math calculations (like 2+2, 2+50), always call the appropriate tool.
3. For math calculations, present the final answer simply and clearly in standard natural text (e.g., "2 + 5 = 7" or "2 + 50 = 52"). Do NOT output LaTeX syntax like \\mathbf{} or repeat the word Result multiple times.
4. Be concise, polite, and format answers using clean GitHub-flavored Markdown.
5. Maintain conversation context and recall information shared earlier by the user.`;

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
  const pastMessages = await getSessionMessages(sessionId);

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
