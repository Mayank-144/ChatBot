import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * In-memory map to store session-specific conversation histories.
 * Key: sessionId (string) -> Value: InMemoryChatMessageHistory
 */
const sessionHistories = new Map();

/**
 * Get or create an InMemoryChatMessageHistory instance for a given session.
 * @param {string} [sessionId='default'] - Unique session identifier
 * @returns {InMemoryChatMessageHistory}
 */
export function getSessionHistory(sessionId = 'default') {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, new InMemoryChatMessageHistory());
  }
  return sessionHistories.get(sessionId);
}

/**
 * Add a user and assistant turn to the session history.
 * @param {string} sessionId
 * @param {string} userInput
 * @param {string} assistantOutput
 */
export async function recordTurn(sessionId = 'default', userInput, assistantOutput) {
  const history = getSessionHistory(sessionId);
  if (userInput) {
    await history.addMessage(new HumanMessage(userInput));
  }
  if (assistantOutput) {
    await history.addMessage(new AIMessage(assistantOutput));
  }
}

/**
 * Get all messages for a session.
 * @param {string} sessionId
 * @returns {Promise<Array>}
 */
export async function getSessionMessages(sessionId = 'default') {
  const history = getSessionHistory(sessionId);
  return await history.getMessages();
}

/**
 * Clear the conversation history for a given session.
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
