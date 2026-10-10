import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { searchDocuments } from '../services/ragService.js';

/**
 * Zod schema for search_documents RAG tool.
 */
const searchDocumentsSchema = z.object({
  query: z
    .string()
    .describe(
      'The semantic query to search inside uploaded documents, PDF files, or Excel spreadsheets (e.g. "sales Q3 summary", "refund policy", "candidate work experience").'
    ),
});

/**
 * Executes semantic vector search over uploaded documents using Cohere embeddings & MongoDB Atlas Vector Search.
 * @param {Object} input - { query: string }
 * @returns {Promise<string>}
 */
async function executeDocumentSearch({ query }) {
  if (!query || !query.trim()) {
    return 'Error: A search query must be provided to search documents.';
  }

  try {
    const results = await searchDocuments({ query: query.trim(), limit: 4 });

    if (!results || results.length === 0) {
      return `No matching information found in uploaded documents for "${query}". Either no documents have been uploaded yet or the content does not match.`;
    }

    const formattedSnippets = results.map((r, idx) => {
      const sourceInfo = [
        r.fileName ? `File: ${r.fileName}` : null,
        r.pageNumber ? `Page: ${r.pageNumber}` : null,
        r.sheetName ? `Sheet: ${r.sheetName}` : null,
      ]
        .filter(Boolean)
        .join(', ');

      return `[Result #${idx + 1} (${sourceInfo})]\n${r.text.trim()}`;
    });

    return `Found ${results.length} relevant document excerpt(s):\n\n${formattedSnippets.join('\n\n---\n\n')}`;
  } catch (err) {
    console.error('❌ [RAG Tool] search_documents error:', err.message);
    return `Failed to search uploaded documents: ${err.message}. Please check MongoDB Atlas and Cohere API configuration.`;
  }
}

/**
 * LangChain Tool for RAG document retrieval.
 * Added to agentTools so the ReAct agent autonomously decides when to query user documents.
 */
export const searchDocumentsTool = tool(executeDocumentSearch, {
  name: 'search_documents',
  description:
    'Searches user-uploaded PDF documents, Excel spreadsheets, reports, and knowledge-base files using semantic vector search. Use this tool whenever the user asks questions about their uploaded files, documents, sheets, or internal data.',
  schema: searchDocumentsSchema,
});

export default searchDocumentsTool;
