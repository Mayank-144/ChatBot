export const config = {
  runtime: 'edge',
};

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
      return new Response(
        JSON.stringify({
          error: {
            message: errData?.error?.message || `Groq API responded with status ${groqResponse.status}`,
          },
        }),
        {
          status: groqResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(groqResponse.body, {
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
