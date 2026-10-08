import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Zod schema for Wikipedia search tool.
 */
const wikiSchema = z.object({
  query: z
    .string()
    .describe('The search query or entity name to look up on Wikipedia (e.g. "Quantum Computing", "Alan Turing", "Taj Mahal", "Mahakaleshwar")'),
});

/**
 * Clean search query by removing conversational filler words.
 * @param {string} text
 * @returns {string}
 */
function sanitizeSearchQuery(text) {
  return (text || '')
    .replace(/(?:kya hai|kya h|kaun hai|ke bare mein|batao|what is|tell me about|who is|who was)/gi, '')
    .trim();
}

/**
 * Searches Wikipedia using the official REST API and returns a concise factual summary.
 * @param {Object} input - { query: string }
 * @returns {Promise<string>}
 */
async function searchWikipedia({ query }) {
  const rawQuery = (query || '').trim();
  const cleanQuery = sanitizeSearchQuery(rawQuery) || rawQuery;

  if (!cleanQuery) {
    return 'Error: A search query must be provided for Wikipedia lookup.';
  }

  try {
    // 1. Search for matching page titles using Wikipedia search API
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanQuery
    )}&format=json&utf8=1&srlimit=3`;

    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'MayankAIChatbot/1.0 (https://github.com/Mayank-144/ChatBot; contact@example.com)',
      },
    });

    if (!searchResponse.ok) {
      return `Wikipedia API search failed with status: ${searchResponse.status}`;
    }

    const searchData = await searchResponse.json();
    const searchResults = searchData?.query?.search || [];

    if (searchResults.length === 0) {
      return `No Wikipedia articles found for "${cleanQuery}".`;
    }

    // 2. Fetch the summary for the top matching page
    const topTitle = searchResults[0].title;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      topTitle.replace(/ /g, '_')
    )}`;

    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'User-Agent': 'MayankAIChatbot/1.0 (https://github.com/Mayank-144/ChatBot; contact@example.com)',
      },
    });

    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      const title = summaryData.title || topTitle;
      const description = summaryData.description || '';
      const extract = summaryData.extract || '';
      const pageUrl = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`;

      return JSON.stringify({
        title,
        description,
        summary: extract.slice(0, 450), // Concise for token efficiency & fast Groq inference
        url: pageUrl,
      });
    }

    // Fallback using snippet from search API if summary endpoint fails
    const snippet = searchResults[0].snippet ? searchResults[0].snippet.replace(/<[^>]*>/g, '') : '';
    return JSON.stringify({
      title: topTitle,
      summary: snippet.slice(0, 350),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`,
    });
  } catch (error) {
    return `Error fetching Wikipedia information for "${cleanQuery}": ${error.message}`;
  }
}

/**
 * LangChain Wikipedia Search Tool definition.
 */
export const wikiTool = tool(searchWikipedia, {
  name: 'wikipedia_search',
  description:
    'Searches Wikipedia for accurate general knowledge, encyclopedia summaries, historical facts, and scientific or biographical information.',
  schema: wikiSchema,
});

export default wikiTool;
