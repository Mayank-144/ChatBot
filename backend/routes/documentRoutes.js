import express from 'express';
import multer from 'multer';
import {
  indexDocument,
  getUploadedDocuments,
  deleteDocument,
  searchDocuments,
} from '../services/ragService.js';

const router = express.Router();

// Configure multer memory storage (files kept in buffer for direct processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(pdf|xlsx|xls|csv|txt|md|json)$/i;
    if (file.originalname.match(allowedExtensions)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, Excel (.xlsx, .xls, .csv), and text files are supported for document indexing.'));
    }
  },
});

/**
 * POST /api/documents/upload
 * Upload and index a document into MongoDB Atlas Vector Search using Cohere embeddings
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded.' } });
    }

    const sessionId = req.body?.sessionId || req.headers['x-session-id'] || 'default';

    const result = await indexDocument({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      sessionId,
    });

    return res.status(201).json({
      success: true,
      message: `Document "${req.file.originalname}" successfully parsed and indexed into vector store.`,
      document: result,
    });
  } catch (error) {
    console.error('❌ [Documents Route] Upload failed:', error.message);
    return res.status(500).json({
      error: {
        message: error.message || 'Failed to parse and index document.',
      },
    });
  }
});

/**
 * GET /api/documents
 * List all indexed documents
 */
router.get('/', async (req, res) => {
  try {
    const sessionId = req.query?.sessionId || req.headers['x-session-id'] || null;
    const documents = await getUploadedDocuments(sessionId);
    return res.json({
      success: true,
      count: documents.length,
      documents,
    });
  } catch (error) {
    console.error('❌ [Documents Route] Fetch failed:', error.message);
    return res.status(500).json({
      error: { message: error.message || 'Failed to fetch indexed documents.' },
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document and its vector chunks
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: { message: 'Document ID is required.' } });
    }

    const result = await deleteDocument(id);
    return res.json({
      success: true,
      message: `Document chunks removed from vector store.`,
      ...result,
    });
  } catch (error) {
    console.error('❌ [Documents Route] Delete failed:', error.message);
    return res.status(500).json({
      error: { message: error.message || 'Failed to delete document.' },
    });
  }
});

/**
 * POST /api/documents/search
 * Direct search endpoint for testing vector similarity
 */
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 4, sessionId } = req.body;
    if (!query) {
      return res.status(400).json({ error: { message: 'Search query is required.' } });
    }

    const results = await searchDocuments({ query, limit, sessionId });
    return res.json({ success: true, count: results.length, results });
  } catch (error) {
    console.error('❌ [Documents Route] Search failed:', error.message);
    return res.status(500).json({
      error: { message: error.message || 'Vector search failed.' },
    });
  }
});

export default router;
