import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env, root .env, or process env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Mayank AI ChatBot Backend API',
    version: '1.0.0',
    model: process.env.GROQ_MODEL || process.env.VITE_MODEL || 'openai/gpt-oss-120b',
    timestamp: new Date().toISOString(),
  });
});

// 2. Chat Completions Streaming Endpoint
app.post('/api/chat', async (req, res) => {
  const { messages, model } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: { message: 'Messages array is required.' } });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: 'GROQ_API_KEY is not configured on the backend server. Please set it in your .env file.',
      },
    });
  }

  // Detect if any message contains image data
  const hasImages = messages.some(
    (m) => (m.images && Array.isArray(m.images) && m.images.length > 0) ||
           (Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url'))
  );

  // Use vision-capable multimodal model when images are present
  const targetModel = hasImages
    ? 'qwen/qwen3.8-27b'
    : (model || process.env.GROQ_MODEL || process.env.VITE_MODEL || 'openai/gpt-oss-120b');

  const groqApiUrl = process.env.GROQ_API_URL || process.env.VITE_API_URL || 'https://api.groq.com/openai/v1/chat/completions';

  // Count total images and enforce max 3 images limit for Groq
  let totalImagesCount = 0;
  const formattedMessages = messages
    .filter((m) => m && (m.content || (m.images && m.images.length > 0)))
    .map((m) => {
      if (m.images && Array.isArray(m.images) && m.images.length > 0 && totalImagesCount < 3) {
        const availableSlots = 3 - totalImagesCount;
        const attachedImages = m.images.slice(0, availableSlots);
        totalImagesCount += attachedImages.length;

        const textPart =
          typeof m.content === 'string' && m.content.trim()
            ? m.content.trim()
            : 'Please describe and analyze what you see in the attached image(s) in detail.';

        return {
          role: m.role || 'user',
          content: [
            { type: 'text', text: textPart },
            ...attachedImages.map((url) => ({
              type: 'image_url',
              image_url: { url },
            })),
          ],
        };
      }

      return {
        role: m.role || 'user',
        content: typeof m.content === 'string' && m.content.trim() ? m.content.trim() : (m.content || 'Hello'),
      };
    });

  try {
    const groqResponse = await fetch(groqApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        stream: true,
      }),
    });

    if (!groqResponse.ok) {
      const errData = await groqResponse.json().catch(() => null);
      return res.status(groqResponse.status).json({
        error: {
          message: errData?.error?.message || `Groq API responded with status ${groqResponse.status}`,
        },
      });
    }

    // Set SSE headers for real-time token streaming to frontend
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reader = groqResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (error) {
    console.error('Backend /api/chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
    } else {
      res.end();
    }
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Mayank AI Backend Server running on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`💬 Chat API:     http://localhost:${PORT}/api/chat`);
  console.log(`=============================================`);
});
