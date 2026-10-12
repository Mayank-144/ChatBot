/**
 * Query Router: Classifies user queries into SIMPLE vs COMPLEX
 * to dynamically route between the Classic ReAct Agent and the LangChain Deep Agent.
 */

// Patterns indicating comparison across entities
const COMPARISON_PATTERNS = [
  /\bcompare\b/i,
  /\bcomparison\b/i,
  /\bvs\.?\b/i,
  /\bversus\b/i,
  /\bdifference between\b/i,
  /\btulna\b/i,
  /\bantar\b/i,
  /\bkaun sa (behtar|accha|bada|chhota)\b/i,
  /\bwhich (one )?(is )?(better|larger|smaller)\b/i,
];

// Patterns indicating sequential or multi-step execution
const SEQUENCE_PATTERNS = [
  /\band then\b/i,
  /\bafter that\b/i,
  /\bphir\b/i,
  /\buske baad\b/i,
  /\bnext\b/i,
  /\btatha\b/i,
  /\bstep[- ]by[- ]step\b/i,
];

// Patterns indicating complex planning or multi-domain tasks
const PLANNING_PATTERNS = [
  /\bplan\b/i,
  /\bplanning\b/i,
  /\bitinerary\b/i,
  /\bbreakdown\b/i,
  /\bchecklist\b/i,
  /\btodo\b/i,
  /\bdetailed analysis\b/i,
  /\bdeep research\b/i,
];

/**
 * Checks if the text has multiple independent task instructions or questions
 * @param {string} text
 * @returns {boolean}
 */
function hasMultipleTasks(text) {
  // Check for multiple questions: e.g. "What is X? And what is Y?"
  const questionMarks = (text.match(/\?/g) || []).length;
  if (questionMarks >= 2) return true;

  // Check for numbered lists: "1. Do this 2. Do that"
  if (/\b1[\.\)]\s+.+\b2[\.\)]\s+/s.test(text)) return true;

  // Check for multiple task conjunctions: e.g. "Delhi ka weather batao aur 25*4 calculate karo"
  const hasToolIntent1 = /(weather|mausam|temp|turing|newton|wikipedia|kya hai)/i.test(text);
  const hasToolIntent2 = /(\d+[\+\-\*\/]\d+|calculate|time|samay|kitna baje)/i.test(text);
  if (hasToolIntent1 && hasToolIntent2 && /(aur|and|phir)/i.test(text)) {
    return true;
  }

  // Check for multi-city weather or multi-topic comparison
  const citiesMentioned = (text.match(/\b(delhi|mumbai|bangalore|kolkata|chennai|ujjain|pune|hyderabad|jaipur)\b/gi) || []).length;
  if (citiesMentioned >= 2 && /(aur|and|compare|dono|difference)/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Analyzes query complexity using deterministic rule heuristics.
 * @param {string} input - User query
 * @returns {{ isComplex: boolean, reason: string }}
 */
export function analyzeComplexity(input) {
  if (!input || typeof input !== 'string') {
    return { isComplex: false, reason: 'empty_input' };
  }

  const trimmed = input.trim();

  // Short direct questions are almost always simple (e.g. "Delhi weather", "2+2", "hi", "who was Einstein")
  if (trimmed.length < 35 && !trimmed.includes('?')) {
    if (!COMPARISON_PATTERNS.some((p) => p.test(trimmed))) {
      return { isComplex: false, reason: 'short_simple_query' };
    }
  }

  // 1. Comparison check
  for (const pattern of COMPARISON_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isComplex: true, reason: 'comparison_detected' };
    }
  }

  // 2. Planning or workflow check
  for (const pattern of PLANNING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isComplex: true, reason: 'planning_intent_detected' };
    }
  }

  // 3. Multi-task or multi-tool sequencing check
  if (hasMultipleTasks(trimmed)) {
    return { isComplex: true, reason: 'multiple_tasks_detected' };
  }

  // 4. Sequential transition check
  for (const pattern of SEQUENCE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isComplex: true, reason: 'sequential_steps_detected' };
    }
  }

  // 5. Very long compound questions (> 160 chars) with conjunctions
  if (trimmed.length > 160 && /\b(aur|and|lekin|but|bhi)\b/i.test(trimmed)) {
    return { isComplex: true, reason: 'long_compound_query' };
  }

  return { isComplex: false, reason: 'standard_direct_query' };
}

/**
 * Decides whether to route query to Deep Agent or Classic ReAct Agent.
 * Respects the USE_DEEP_AGENT environment variable flag.
 *
 * @param {string} input - User prompt
 * @param {Object} [options]
 * @param {boolean} [options.forceDeep] - Manually force Deep Agent
 * @returns {{ route: 'deep' | 'react', isComplex: boolean, reason: string }}
 */
export function routeQuery(input, options = {}) {
  const isDeepAgentFlagEnabled =
    process.env.USE_DEEP_AGENT === 'true' || options.forceDeep === true;

  // If USE_DEEP_AGENT flag is false or disabled, always route to classic ReAct agent
  if (!isDeepAgentFlagEnabled) {
    return {
      route: 'react',
      isComplex: false,
      reason: 'deep_agent_disabled_by_env',
    };
  }

  const analysis = analyzeComplexity(input);

  if (analysis.isComplex) {
    return {
      route: 'deep',
      isComplex: true,
      reason: analysis.reason,
    };
  }

  return {
    route: 'react',
    isComplex: false,
    reason: analysis.reason,
  };
}

export default {
  analyzeComplexity,
  routeQuery,
};
