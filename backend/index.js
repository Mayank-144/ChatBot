import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgent } from './agent/index.js';
import { agentTools, setMcpClient } from './tools/index.js';
import { clearSessionHistory } from './agent/memory.js';
import { connectDB, getDb } from './config/db.js';
import documentRoutes from './routes/documentRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env, root .env, or process env
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Document RAG Routes (Upload, Search, Delete)
app.use('/api/documents', documentRoutes);

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Mayank AI ChatBot Backend API (LangChain + MCP + RAG)',
    version: '2.1.0',
    model: process.env.GROQ_MODEL || process.env.VITE_MODEL || 'llama-3.3-70b-versatile',
    activeTools: agentTools.map((t) => t.name),
    database: {
      mongodb: Boolean(getDb()),
    },
    timestamp: new Date().toISOString(),
  });
});

// 2. Clear Session Memory Endpoint
app.post('/api/memory/clear', (req, res) => {
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || 'default';
  const cleared = clearSessionHistory(sessionId);
  return res.json({ success: true, cleared, sessionId });
});

// 3. Chat Completions Streaming Endpoint (LangChain Agent + Vision Routing)
app.post('/api/chat', async (req, res) => {
  const { messages, model, sessionId = 'default' } = req.body;

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

  // Detect if any message contains image attachments
  const hasImages = messages.some(
    (m) =>
      (m.images && Array.isArray(m.images) && m.images.length > 0) ||
      (Array.isArray(m.content) && m.content.some((c) => c.type === 'image_url'))
  );

  // If multimodal vision images are attached, handle directly via Groq Vision API
  if (hasImages) {
    const visionModel = 'qwen/qwen3.8-27b';
    const groqApiUrl =
      process.env.GROQ_API_URL ||
      process.env.VITE_API_URL ||
      'https://api.groq.com/openai/v1/chat/completions';

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
          content:
            typeof m.content === 'string' && m.content.trim()
              ? m.content.trim()
              : m.content || 'Hello',
        };
      });

    try {
      const visionRes = await fetch(groqApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: visionModel,
          messages: formattedMessages,
          stream: true,
        }),
      });

      if (!visionRes.ok) {
        const errData = await visionRes.json().catch(() => null);
        let errMsg = errData?.error?.message || `Groq API responded with status ${visionRes.status}`;
        if (visionRes.status === 429) {
          errMsg = 'Groq free tier rate limit reached. Please wait ~10 seconds and try sending again.';
        }
        return res.status(visionRes.status).json({ error: { message: errMsg } });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = visionRes.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      return res.end();
    } catch (visionErr) {
      console.error('Vision streaming error:', visionErr);
      if (!res.headersSent) {
        return res.status(500).json({ error: { message: visionErr.message } });
      }
      return res.end();
    }
  }

  // Handle standard text & tool reasoning queries with LangChain Agent
  const latestUserMessage = messages[messages.length - 1];
  const userInput =
    typeof latestUserMessage.content === 'string'
      ? latestUserMessage.content
      : JSON.stringify(latestUserMessage.content || '');

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const toolsUsed = [];
    let streamedAnyToken = false;

    const agentResult = await runAgent({
      input: userInput,
      sessionId,
      tools: agentTools,
      onToolStart: (toolData) => {
        if (toolData.name && !toolsUsed.includes(toolData.name)) {
          toolsUsed.push(toolData.name);
          // Broadcast tool usage badge event to frontend
          res.write(`data: ${JSON.stringify({ toolsUsed })}\n\n`);
        }
      },
      onToken: (chunk) => {
        streamedAnyToken = true;
        // Stream token to frontend in OpenAI SSE format
        res.write(
          `data: ${JSON.stringify({
            choices: [{ delta: { content: chunk }, finish_reason: null }],
          })}\n\n`
        );
      },
    });

    // If no tokens were streamed in real-time during execution, write the final output
    if (!streamedAnyToken) {
      const finalAnswer = agentResult.output;
      if (finalAnswer && !res.writableEnded) {
        // Chunk output smoothly for typing experience if it was buffered
        const chunkSize = 20;
        for (let i = 0; i < finalAnswer.length; i += chunkSize) {
          const piece = finalAnswer.slice(i, i + chunkSize);
          res.write(
            `data: ${JSON.stringify({
              choices: [{ delta: { content: piece }, finish_reason: null }],
            })}\n\n`
          );
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    }

    res.write(
      `data: ${JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
      })}\n\n`
    );
    res.write('data: [DONE]\n\n');
    return res.end();
  } catch (agentErr) {
    console.error('Agent execution error:', agentErr);
    if (!res.headersSent) {
      return res.status(500).json({ error: { message: agentErr.message || 'Agent error' } });
    }
    res.write(
      `data: ${JSON.stringify({
        choices: [{ delta: { content: `\n\n*Error: ${agentErr.message}*` }, finish_reason: 'error' }],
      })}\n\n`
    );
    res.write('data: [DONE]\n\n');
    return res.end();
  }
});

// 4. Audio Transcription Endpoint (Groq Whisper)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType, fileName } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: { message: 'audioBase64 is required' } });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: { message: 'GROQ_API_KEY is not configured' } });
    }

    const base64Data = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: mimeType || 'audio/wav' });

    const formData = new FormData();
    formData.append('file', blob, fileName || 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.json().catch(() => null);
      throw new Error(err?.error?.message || `Whisper API failed with status ${whisperResponse.status}`);
    }

    const data = await whisperResponse.json();
    return res.json({ text: data.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ error: { message: error.message || 'Failed to transcribe audio' } });
  }
});

// 5. MCP Tools Test Endpoints (Direct HTTP Testing)
let mcpClient = null;
let mcpTools = [];

app.get('/api/mcp/tools', (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({ error: 'MCP Client is not connected.' });
  }
  return res.json({
    status: 'connected',
    totalTools: mcpTools.length,
    tools: mcpTools,
  });
});

app.get('/api/mcp/time', async (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({ error: 'MCP Client is not connected.' });
  }
  try {
    const result = await mcpClient.callTool({
      name: 'get_time',
      arguments: {},
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to call get_time' });
  }
});

app.get('/api/mcp/calculate', async (req, res) => {
  if (!mcpClient) {
    return res.status(503).json({ error: 'MCP Client is not connected.' });
  }
  try {
    const a = parseFloat(req.query.a ?? '0');
    const b = parseFloat(req.query.b ?? '0');
    const operation = req.query.op || req.query.operation || 'add';

    const result = await mcpClient.callTool({
      name: 'calculator',
      arguments: { a, b, operation },
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to call calculator' });
  }
});

// MCP Client initialization
async function initMcpClient() {
  try {
    const mcpServerPath = path.resolve(__dirname, '../mcp-server/index.js');
    console.log(`🔌 Connecting to MCP Server at: ${mcpServerPath}...`);

    const transport = new StdioClientTransport({
      command: 'node',
      args: [mcpServerPath],
    });

    mcpClient = new Client(
      { name: 'chatbot-backend-client', version: '1.0.0' },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    const toolsResult = await mcpClient.listTools();
    mcpTools = toolsResult.tools || [];
    const toolNames = mcpTools.map((t) => t.name);

    // Share client with LangChain MCP tool wrappers
    setMcpClient(mcpClient);

    console.log(`✅ MCP Client connected successfully!`);
    console.log(`🛠️ Available MCP Tools (${toolNames.length}):`, toolNames);
    return mcpClient;
  } catch (error) {
    console.error('❌ Failed to connect to MCP Server:', error.message || error);
    return null;
  }
}

// Start Server
app.listen(PORT, async () => {
  console.log(`=============================================`);
  console.log(`🚀 Mayank AI Backend Server running on port ${PORT}`);
  console.log(`🔗 Health Check:    http://localhost:${PORT}/api/health`);
  console.log(`💬 Chat API:        http://localhost:${PORT}/api/chat`);
  console.log(`🎙️ Audio Transcribe: http://localhost:${PORT}/api/transcribe`);
  console.log(`🛠️ MCP Tools List:  http://localhost:${PORT}/api/mcp/tools`);
  console.log(`🕒 MCP Time Test:   http://localhost:${PORT}/api/mcp/time`);
  console.log(`🧮 MCP Calc Test:   http://localhost:${PORT}/api/mcp/calculate?a=25&b=4&op=multiply`);
  console.log(`📄 Document RAG:    http://localhost:${PORT}/api/documents`);
  console.log(`=============================================`);

  // Connect to MongoDB Atlas for RAG Vector Search
  await connectDB();

  // Initialize MCP client connection
  await initMcpClient();
});
