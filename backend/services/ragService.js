import { CohereClient } from 'cohere-ai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import { getVectorCollection, getDb } from '../config/db.js';

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const EMBED_MODEL = process.env.COHERE_MODEL || 'embed-multilingual-v3.0';
const VECTOR_INDEX_NAME = process.env.MONGODB_VECTOR_INDEX || 'vector_index';

// Initialize Cohere Client if API key is provided
let cohereClient = null;
function getCohereClient() {
  if (!cohereClient) {
    const key = process.env.COHERE_API_KEY;
    if (!key) {
      throw new Error('COHERE_API_KEY is not configured in backend environment (.env).');
    }
    cohereClient = new CohereClient({ token: key });
  }
  return cohereClient;
}

/**
 * Generate embeddings using Cohere embed-multilingual-v3.0
 * @param {string[]} texts 
 * @param {'search_document'|'search_query'} inputType 
 * @returns {Promise<number[][]>}
 */
export async function generateEmbeddings(texts, inputType = 'search_document') {
  if (!texts || texts.length === 0) return [];
  const client = getCohereClient();

  // Cohere allows up to 96 texts per embed call
  const BATCH_SIZE = 64;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embed({
      texts: batch,
      model: EMBED_MODEL,
      inputType: inputType,
      embeddingTypes: ['float'],
    });

    const embeddings = response.embeddings?.float || response.embeddings;
    if (Array.isArray(embeddings)) {
      allEmbeddings.push(...embeddings);
    } else {
      throw new Error('Unexpected embeddings response structure from Cohere API.');
    }
  }

  return allEmbeddings;
}

/**
 * Generate embedding for a single user search query
 * @param {string} query 
 * @returns {Promise<number[]>}
 */
export async function generateQueryEmbedding(query) {
  const embeddings = await generateEmbeddings([query], 'search_query');
  return embeddings[0];
}

/**
 * Extract structured text chunks from PDF, Excel, or plain text buffer
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.originalname
 * @param {string} params.mimetype
 * @returns {Promise<Array<{ text: string, metadata: Object }>>}
 */
export async function parseDocumentSections({ buffer, originalname = '', mimetype = '' }) {
  const ext = originalname.toLowerCase().split('.').pop() || '';
  const sections = [];

  // 1. PDF Parser
  if (ext === 'pdf' || mimetype.includes('pdf')) {
    try {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      await parser.destroy();

      if (textResult.pages && textResult.pages.length > 0) {
        for (const page of textResult.pages) {
          if (page.text && page.text.trim()) {
            sections.push({
              text: page.text.trim(),
              metadata: {
                fileName: originalname,
                fileType: 'pdf',
                pageNumber: page.num,
              },
            });
          }
        }
      } else if (textResult.text && textResult.text.trim()) {
        sections.push({
          text: textResult.text.trim(),
          metadata: {
            fileName: originalname,
            fileType: 'pdf',
            pageNumber: 1,
          },
        });
      }
    } catch (err) {
      console.error(`[RAG] PDF parsing error for ${originalname}:`, err.message);
      throw new Error(`Failed to parse PDF file "${originalname}": ${err.message}`);
    }
  }
  // 2. Excel Parser (.xlsx, .xls, .csv)
  else if (['xlsx', 'xls', 'csv'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('csv')) {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csvContent = XLSX.utils.sheet_to_csv(sheet);
        if (csvContent && csvContent.trim()) {
          sections.push({
            text: `[Sheet: ${sheetName}]\n${csvContent.trim()}`,
            metadata: {
              fileName: originalname,
              fileType: ext,
              sheetName,
            },
          });
        }
      }
    } catch (err) {
      console.error(`[RAG] Excel parsing error for ${originalname}:`, err.message);
      throw new Error(`Failed to parse spreadsheet "${originalname}": ${err.message}`);
    }
  }
  // 3. Plain Text / Markdown / Fallback
  else {
    const rawText = buffer.toString('utf-8');
    if (rawText.trim()) {
      sections.push({
        text: rawText.trim(),
        metadata: {
          fileName: originalname,
          fileType: ext || 'text',
        },
      });
    }
  }

  if (sections.length === 0) {
    throw new Error(`No readable text content could be extracted from "${originalname}".`);
  }

  return sections;
}

/**
 * Ingest and index an uploaded document into MongoDB Atlas with Cohere embeddings
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.originalname
 * @param {string} params.mimetype
 * @param {string} [params.sessionId='default']
 * @returns {Promise<{ documentId: string, fileName: string, totalChunks: number }>}
 */
export async function indexDocument({ buffer, originalname, mimetype, sessionId = 'default' }) {
  const collection = getVectorCollection();
  if (!collection) {
    throw new Error('MongoDB Atlas is not connected. Please ensure MONGODB_URI is set.');
  }

  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`📄 [RAG] Parsing document: "${originalname}" (ID: ${documentId})`);

  // 1. Extract sections
  const sections = await parseDocumentSections({ buffer, originalname, mimetype });

  // 2. Split sections into text chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 120,
  });

  const chunksToEmbed = [];
  for (const section of sections) {
    const subChunks = await splitter.splitText(section.text);
    for (let i = 0; i < subChunks.length; i++) {
      chunksToEmbed.push({
        text: subChunks[i],
        metadata: {
          ...section.metadata,
          documentId,
          sessionId,
          subChunkIndex: i,
        },
      });
    }
  }

  if (chunksToEmbed.length === 0) {
    throw new Error(`Document "${originalname}" produced zero text chunks.`);
  }

  console.log(`🧩 [RAG] Generating multilingual Cohere embeddings for ${chunksToEmbed.length} chunks...`);

  // 3. Generate Cohere embeddings
  const texts = chunksToEmbed.map((c) => c.text);
  const embeddings = await generateEmbeddings(texts, 'search_document');

  // 4. Prepare MongoDB documents
  const now = new Date();
  const mongoDocs = chunksToEmbed.map((chunk, idx) => ({
    documentId,
    sessionId,
    fileName: originalname,
    fileType: chunk.metadata.fileType || 'unknown',
    pageNumber: chunk.metadata.pageNumber || null,
    sheetName: chunk.metadata.sheetName || null,
    chunkIndex: idx,
    totalChunks: chunksToEmbed.length,
    text: chunk.text,
    embedding: embeddings[idx],
    createdAt: now,
  }));

  // 5. Store in MongoDB
  await collection.insertMany(mongoDocs);
  console.log(`✅ [RAG] Successfully indexed "${originalname}" (${mongoDocs.length} vector chunks) into MongoDB.`);

  return {
    documentId,
    fileName: originalname,
    totalChunks: mongoDocs.length,
    uploadedAt: now.toISOString(),
  };
}

/**
 * Cosine similarity helper for fallback search
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search indexed documents using MongoDB Atlas Vector Search
 * @param {Object} params
 * @param {string} params.query - Search query
 * @param {number} [params.limit=4] - Number of chunks to retrieve
 * @param {string} [params.sessionId] - Optional session filter
 * @returns {Promise<Array<{ text: string, fileName: string, score: number, pageNumber?: number, sheetName?: string }>>}
 */
export async function searchDocuments({ query, limit = 4, sessionId }) {
  const collection = getVectorCollection();
  if (!collection) {
    throw new Error('MongoDB connection is unavailable.');
  }

  if (!query || !query.trim()) {
    return [];
  }

  // 1. Generate query embedding with Cohere
  const queryEmbedding = await generateQueryEmbedding(query.trim());

  // 2. Attempt MongoDB Atlas $vectorSearch aggregation
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: Math.max(limit * 10, 50),
          limit: limit,
          ...(sessionId ? { filter: { sessionId } } : {}),
        },
      },
      {
        $project: {
          _id: 1,
          documentId: 1,
          fileName: 1,
          text: 1,
          pageNumber: 1,
          sheetName: 1,
          chunkIndex: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();
    if (results.length > 0) {
      return results.map((r) => ({
        documentId: r.documentId,
        fileName: r.fileName,
        pageNumber: r.pageNumber,
        sheetName: r.sheetName,
        text: r.text,
        score: r.score ?? 1.0,
      }));
    }
  } catch (atlasErr) {
    console.warn(
      `⚠️ [RAG] MongoDB Atlas $vectorSearch index "${VECTOR_INDEX_NAME}" not ready or failed (${atlasErr.message}). Using fallback vector calculation.`
    );
  }

  // Fallback: in-memory cosine similarity over existing collection documents
  // Ensures RAG still responds even if the Atlas index is building or pending creation
  const queryFilter = sessionId ? { sessionId } : {};
  const allDocs = await collection
    .find(queryFilter, {
      projection: { _id: 1, documentId: 1, fileName: 1, pageNumber: 1, sheetName: 1, text: 1, embedding: 1 },
    })
    .limit(200)
    .toArray();

  if (!allDocs || allDocs.length === 0) {
    return [];
  }

  const scored = allDocs
    .map((doc) => ({
      documentId: doc.documentId,
      fileName: doc.fileName,
      pageNumber: doc.pageNumber,
      sheetName: doc.sheetName,
      text: doc.text,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

/**
 * Retrieve list of all unique ingested documents
 * @param {string} [sessionId] 
 */
export async function getUploadedDocuments(sessionId) {
  const collection = getVectorCollection();
  if (!collection) return [];

  const filter = sessionId ? { sessionId } : {};
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: '$documentId',
        fileName: { $first: '$fileName' },
        fileType: { $first: '$fileType' },
        totalChunks: { $max: '$totalChunks' },
        actualCount: { $sum: 1 },
        uploadedAt: { $first: '$createdAt' },
      },
    },
    { $sort: { uploadedAt: -1 } },
  ];

  const docs = await collection.aggregate(pipeline).toArray();
  return docs.map((d) => ({
    documentId: d._id,
    fileName: d.fileName,
    fileType: d.fileType,
    totalChunks: d.totalChunks || d.actualCount,
    uploadedAt: d.uploadedAt,
  }));
}

/**
 * Delete a document and all its indexed vector chunks
 * @param {string} documentId 
 */
export async function deleteDocument(documentId) {
  const collection = getVectorCollection();
  if (!collection) {
    throw new Error('MongoDB connection is unavailable.');
  }

  const result = await collection.deleteMany({ documentId });
  return { deletedChunks: result.deletedCount, success: true };
}
