export const config = {
  runtime: 'edge',
};

// Available Tools for Groq Model
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_time',
      description: 'Returns the current real-time date, time, timestamp, and timezone',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Performs basic arithmetic operations: add, subtract, multiply, or divide on two numbers',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number', description: 'The first number' },
          b: { type: 'number', description: 'The second number' },
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'Operation to perform: add, subtract, multiply, divide',
          },
        },
        required: ['a', 'b', 'operation'],
      },
    },
  },
];

// Tool Executor on Vercel Serverless
function executeTool(name, args) {
  if (name === 'get_time') {
    const now = new Date();
    return JSON.stringify({
      iso: now.toISOString(),
      local: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      timestamp: now.getTime(),
      timezone: 'Asia/Kolkata (IST)',
    });
  }

  if (name === 'calculator') {
    const a = Number(args?.a || 0);
    const b = Number(args?.b || 0);
    const operation = args?.operation || 'add';

    let result;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) return JSON.stringify({ isError: true, error: 'Division by zero is not allowed' });
        result = a / b;
        break;
      default:
        return JSON.stringify({ isError: true, error: `Unsupported operation: ${operation}` });
    }
    return JSON.stringify({ a, b, operation, result });
  }

  return JSON.stringify({ error: `Tool '${name}' is not recognized` });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages, model } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: { message: 'Messages array is required.' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'GROQ_API_KEY is not configured. Please set it in your Vercel Environment Variables.',
          },
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
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

    let conversationMessages = [...formattedMessages];
    let finalContent = '';
    const toolsUsed = [];
    const maxToolIterations = 5;
    let iteration = 0;

    // Multi-turn tool loop
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
          tools: TOOLS,
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
        return new Response(JSON.stringify({ error: { message: errMsg } }), {
          status: callRes.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const callData = await callRes.json();
      const choice = callData.choices?.[0];

      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
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

          const toolResult = executeTool(toolName, toolArgs);

          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: toolResult,
          });
        }
        continue;
      } else {
        finalContent = choice?.message?.content || '';
        break;
      }
    }

    // Return SSE stream with toolsUsed badge info and token chunks
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        if (toolsUsed.length > 0) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ toolsUsed })}\n\n`));
        }

        const chunkSize = 16;
        for (let i = 0; i < finalContent.length; i += chunkSize) {
          const chunk = finalContent.slice(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                choices: [{ delta: { content: chunk }, finish_reason: null }],
              })}\n\n`
            )
          );
          await new Promise((r) => setTimeout(r, 10));
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              choices: [{ delta: {}, finish_reason: 'stop' }],
            })}\n\ndata: [DONE]\n\n`
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Vercel /api/chat error:', error);
    return new Response(JSON.stringify({ error: { message: error.message || 'Internal Server Error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

