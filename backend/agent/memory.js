import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage } from '@langchain/core/messages';

/**
 * Maximum number of messages kept in active memory window for rate-limit and context safety.
 */
export const MAX_MEMORY_WINDOW = 10;

/**
 * In-memory map to store session-specific conversation histories.
 * Key: sessionId (string) -> Value: InMemoryChatMessageHistory
 */
const sessionHistories = new Map();

/**
 * Get or create an InMemoryChatMessageHistory instance for a given session.
 * @param {string} [sessionId='default'] - Unique session identifier (e.g. timestamp or user session)
 * @returns {InMemoryChatMessageHistory}
 */
export function getSessionHistory(sessionId = 'default') {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId);
}

/**
 * Add a user turn (input) and assistant turn (output) to the session memory.
 * @param {string} sessionId
 * @param {string} userInput - inputKey: "input"
 * @param {string} assistantOutput - outputKey: "output"
 */
export async function recordTurn(sessionId = 'default', userInput, assistantOutput) {
  const history = getSessionHistory(sessionId);
  if (userInput && typeof userInput === 'string') {
    await history.addMessage(new HumanMessage(userInput));
  }
  if (assistantOutput && typeof assistantOutput === 'string') {
    await history.addMessage(new AIMessage(assistantOutput));
  }
}

/**
 * Get messages for a session windowed to the last MAX_MEMORY_WINDOW (10) messages.
 * @param {string} sessionId
 * @returns {Promise<Array<HumanMessage|AIMessage>>}
 */
export async function getSessionMessages(sessionId = 'default') {
  const history = getSessionHistory(sessionId);
  const allMessages = await history.getMessages();
  return allMessages.slice(-MAX_MEMORY_WINDOW);
}

/**
 * Clear the conversation memory for a given session (used when user clicks Clear Chat).
 * @param {string} [sessionId='default']
 * @returns {boolean}
 */
export function clearSessionHistory(sessionId = 'default') {
  if (sessionHistories.has(sessionId)) {
    sessionHistories.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Get all active session IDs.
 * @returns {string[]}
 */
export function getActiveSessions() {
  return Array.from(sessionHistories.keys());
}

export default {
  getSessionHistory,
  recordTurn,
  getSessionMessages,
  clearSessionHistory,
  getActiveSessions,
  MAX_MEMORY_WINDOW,
};
