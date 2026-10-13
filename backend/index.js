import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runAgent } from './agent/index.js';
import { runDeepAgent } from './agent/deepAgent.js';
import { routeQuery } from './agent/router.js';
import { agentTools, setMcpClient } from './tools/index.js';
import { clearSessionHistory } from './agent/memory.js';
import { resolveApproval, getPendingApproval } from './agent/approvalManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (.env in backend/ or root)
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'Mayank AI ChatBot Backend API (LangChain + MCP)',
    version: '2.0.0',
    model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    deepAgentEnabled: process.env.USE_DEEP_AGENT === 'true',
    activeTools: agentTools.map((t) => t.name),
    timestamp: new Date().toISOString(),
  });
});

// 2. Clear Session Memory Endpoint
app.post('/api/memory/clear', (req, res) => {
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || 'default';
  const cleared = clearSessionHistory(sessionId);
  return res.json({ success: true, cleared, sessionId });
});

// 2b. Human-in-the-Loop (HITL) Decision Endpoint
app.post('/api/approval', (req, res) => {
  const { approvalId, sessionId, decision } = req.body || {};
  if (!decision || !['approve', 'reject', 'approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'Valid decision ("approve" or "reject") is required.' });
  }

  const result = resolveApproval({ approvalId, sessionId, decision });
  return res.json(result);
});

// 2c. Get Active Pending Approval
app.get('/api/approval/:sessionId?', (req, res) => {
  const sessionId = req.params?.sessionId || req.query?.sessionId || req.headers['x-session-id'] || 'default';
  const pending = getPendingApproval(sessionId);
  return res.json({ pending });
});

// 3. Chat Completions Streaming Endpoint (LangChain Agent + Vision Routing)
app.post('/api/chat', async (req, res) => {
  const sessionId = req.body?.sessionId || req.headers['x-session-id'] || 'default';
  const { messages } = req.body;

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

    // Route query between Classic ReAct Agent and Deep Agent
    const routeDecision = routeQuery(userInput, { forceDeep: req.body?.forceDeep });
    console.log(`🧭 Query Route: [${routeDecision.route.toUpperCase()}] Reason: ${routeDecision.reason}`);

    // Broadcast routing decision to frontend SSE
    res.write(`data: ${JSON.stringify({ agentRoute: routeDecision.route, reason: routeDecision.reason })}\n\n`);

    const toolsUsed = [];
    let streamedAnyToken = false;

    let agentResult;

    if (routeDecision.route === 'deep') {
      try {
        agentResult = await runDeepAgent({
          input: userInput,
          sessionId,
          tools: agentTools,
          onToolStart: (toolData) => {
            // Preserve classic tool badges behaviour for actual tools (weather, wiki, calculator, time)
            const metaTools = ['write_todos', 'task', 'write_file', 'read_file', 'edit_file', 'ls'];
            if (toolData.name && !metaTools.includes(toolData.name) && !toolsUsed.includes(toolData.name)) {
              toolsUsed.push(toolData.name);
              res.write(`data: ${JSON.stringify({ toolsUsed })}\n\n`);
            }
          },
          onTodoUpdate: (todos) => {
            // Dedicated SSE event when write_todos updates: { todos: [...] }
            res.write(`data: ${JSON.stringify({ todos })}\n\n`);
          },
          onSubagentEvent: (subagentEvt) => {
            // Dedicated SSE event when task tool starts/ends: { subagent: name, status }
            res.write(
              `data: ${JSON.stringify({
                subagent: subagentEvt.name,
                status: subagentEvt.status,
                task: subagentEvt.task || undefined,
              })}\n\n`
            );
          },
          onApprovalRequest: (approvalReq) => {
            // Dedicated SSE event when Human-in-the-Loop approval is requested
            res.write(`data: ${JSON.stringify({ approvalRequest: approvalReq })}\n\n`);
          },
          onToken: (chunk) => {
            streamedAnyToken = true;
            res.write(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: chunk }, finish_reason: null }],
              })}\n\n`
            );
          },
        });
      } catch (deepErr) {
        // If Deep Agent fails before streaming tokens, fall back gracefully to classic ReAct agent
        if (!streamedAnyToken) {
          console.warn('⚠️ Deep Agent failed, falling back to classic ReAct agent:', deepErr.message);
          agentResult = await runAgent({
            input: userInput,
            sessionId,
            tools: agentTools,
            onToolStart: (toolData) => {
              if (toolData.name && !toolsUsed.includes(toolData.name)) {
                toolsUsed.push(toolData.name);
                res.write(`data: ${JSON.stringify({ toolsUsed })}\n\n`);
              }
            },
            onToken: (chunk) => {
              streamedAnyToken = true;
              res.write(
                `data: ${JSON.stringify({
                  choices: [{ delta: { content: chunk }, finish_reason: null }],
                })}\n\n`
              );
            },
          });
        } else {
          throw deepErr;
        }
      }
    } else {
      agentResult = await runAgent({
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
    }

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
    const friendlyMessage = formatUserFriendlyError(agentErr);

    if (!res.headersSent) {
      return res.status(500).json({ error: { message: friendlyMessage } });
    }
    res.write(
      `data: ${JSON.stringify({
        choices: [{ delta: { content: `\n\n${friendlyMessage}` }, finish_reason: 'error' }],
      })}\n\n`
    );
    res.write('data: [DONE]\n\n');
    return res.end();
  }
});

/**
 * Formats backend, Groq rate limit, or tool errors into clean, friendly user notifications.
 * @param {Error|any} error
 * @returns {string}
 */
export function formatUserFriendlyError(error) {
  const errMsg = error?.message || error?.cause?.message || String(error || '');
  const errLower = errMsg.toLowerCase();

  // 1. Groq 429 Rate Limit
  if (errLower.includes('429') || errLower.includes('rate limit') || errLower.includes('rate_limit_exceeded')) {
    const match = errMsg.match(/try again in ([\d\.]+s?)/i);
    const retryIn = match ? ` (${match[1]})` : '';
    return `⚠️ **Groq Rate Limit (429)**\n\nGroq API ka per-minute token quota exceed ho gaya hai${retryIn}. Kripya 5-10 seconds wait karein aur dobara try karein. (Tips: Complex multi-step queries ko chhota karke puchein).`;
  }

  // 2. Timeout
  if (errLower.includes('timeout') || errLower.includes('etimedout') || error?.name === 'TimeoutError') {
    return `⏱️ **Request Timeout**\n\nExternal tool ya AI service se response aane mein samay lag raha hai. Kripya thodi der baad dubara prayas karein.`;
  }

  // 3. Recursion limit
  if (errLower.includes('recursion') || errLower.includes('recursionlimit')) {
    return `⚠️ **Complexity Limit**\n\nIs multi-step task ke execution steps maximum allowed limit (recursion limit) tak pahunch gaye. Kripya apne sawal ko thoda simplify karke puchein.`;
  }

  // 4. Missing API key
  if (errLower.includes('api key') && errLower.includes('not configured')) {
    return `🔑 **Configuration Error**\n\nGroq API Key backend .env file mein configured nahi hai. Kripya GROQ_API_KEY check karein.`;
  }

  // 5. Tool Call Validation / Model Formatting Error
  if (errLower.includes('tool call validation failed') || errLower.includes('middlewareerror')) {
    return `⚠️ **Model Formatting Notice**\n\nAI model dwara tool call format mein unexpected token receive hua. Kripya query ko dobara bhejein.`;
  }

  return `⚠️ **Kuch galat hua**: ${errMsg}`;
}

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
  console.log(`=============================================`);

  // Initialize MCP client connection
  await initMcpClient();
});
