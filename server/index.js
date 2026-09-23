import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

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
    // Convert MCP tools into OpenAI / Groq function calling format
    const groqTools = formatMcpToolsForGroq(mcpTools);
    let conversationMessages = [...formattedMessages];
    let finalContent = '';
    const toolsUsed = [];
    const maxToolIterations = 5;
    let iteration = 0;

    if (groqTools && groqTools.length > 0 && mcpClient) {
      while (iteration < maxToolIterations) {
        iteration++;

        const callRes = await fetch(groqApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages: conversationMessages,
            tools: groqTools,
            tool_choice: 'auto',
            stream: false,
          }),
        });

        if (!callRes.ok) {
          const errData = await callRes.json().catch(() => null);
          let errMsg = errData?.error?.message || `Groq API responded with status ${callRes.status}`;
          if (callRes.status === 429) {
            errMsg = 'Groq free tier rate limit reached. Please wait ~10 seconds and try sending again.';
          }
          return res.status(callRes.status).json({ error: { message: errMsg } });
        }

        const callData = await callRes.json();
        const choice = callData.choices?.[0];

        // If the model called one or more tools
        if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
          console.log(`🤖 [Iteration ${iteration}] Groq requested tools:`, choice.message.tool_calls.map((t) => t.function?.name));
          conversationMessages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            const toolName = toolCall.function?.name;
            if (toolName && !toolsUsed.includes(toolName)) {
              toolsUsed.push(toolName);
            }

            let toolArgs = {};
            try {
              toolArgs =
                typeof toolCall.function?.arguments === 'string'
                  ? JSON.parse(toolCall.function.arguments)
                  : (toolCall.function?.arguments || {});
            } catch (e) {
              toolArgs = {};
            }

            console.log(`⚡ Calling MCP Tool '${toolName}' with arguments:`, toolArgs);

            let toolOutputText = '';
            try {
              const mcpResult = await mcpClient.callTool({
                name: toolName,
                arguments: toolArgs,
              });

              if (mcpResult?.content && Array.isArray(mcpResult.content)) {
                toolOutputText = mcpResult.content
                  .map((c) => (typeof c.text === 'string' ? c.text : JSON.stringify(c)))
                  .join('\n');
              } else {
                toolOutputText = JSON.stringify(mcpResult);
              }
            } catch (toolErr) {
              console.error(`❌ Error executing MCP tool '${toolName}':`, toolErr);
              toolOutputText = `Error executing tool: ${toolErr.message || toolErr}`;
            }

            console.log(`📥 MCP Tool '${toolName}' result:`, toolOutputText);

            conversationMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: toolOutputText,
            });
          }

          // Continue the loop to allow model to call another tool or give final answer
          continue;
        } else {
          // Model finished with natural language answer
          finalContent = choice?.message?.content || '';
          break;
        }
      }

      // Stream the final content to frontend with SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      if (toolsUsed.length > 0) {
        res.write(`data: ${JSON.stringify({ toolsUsed })}\n\n`);
      }

      const chunkSize = 16;
      for (let i = 0; i < finalContent.length; i += chunkSize) {
        const chunk = finalContent.slice(i, i + chunkSize);
        const sseData = `data: ${JSON.stringify({
          choices: [{ delta: { content: chunk }, finish_reason: null }],
        })}\n\n`;
        res.write(sseData);
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      res.write(`data: ${JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      // Direct stream if MCP tools are not enabled
      const directRes = await fetch(groqApiUrl, {
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

      if (!directRes.ok) {
        const errData = await directRes.json().catch(() => null);
        let errMsg = errData?.error?.message || `Groq API responded with status ${directRes.status}`;
        if (directRes.status === 429) {
          errMsg = 'Groq free tier rate limit reached. Please wait ~10 seconds and try sending again.';
        }
        return res.status(directRes.status).json({ error: { message: errMsg } });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const reader = directRes.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }

      return res.end();
    }
  } catch (error) {
    console.error('Backend /api/chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: error.message || 'Internal Server Error' } });
    } else {
      res.end();
    }
  }
});

// 3. Audio Transcription Endpoint (Groq Whisper)
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

// 4. MCP Tools Test Endpoints (Direct HTTP Testing)
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
    const a = Number(req.query.a ?? 10);
    const b = Number(req.query.b ?? 5);
    const operation = req.query.op || 'add';

    const result = await mcpClient.callTool({
      name: 'calculator',
      arguments: { a, b, operation },
    });
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to call calculator' });
  }
});

// Helper: Convert MCP tools schema to OpenAI / Groq tools format
function formatMcpToolsForGroq(tools) {
  if (!tools || !Array.isArray(tools) || tools.length === 0) return null;
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema || {
        type: 'object',
        properties: {},
      },
    },
  }));
}

// MCP Client instance & initialization
let mcpClient = null;
let mcpTools = [];

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

  // Initialize MCP client and list tools
  await initMcpClient();
});

