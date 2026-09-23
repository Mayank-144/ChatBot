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
    const { audioBase64, mimeType, fileName } = await req.json();
    if (!audioBase64) {
      return new Response(JSON.stringify({ error: { message: 'audioBase64 is required' } }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.VITE_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: { message: 'GROQ_API_KEY is not configured' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const base64Clean = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(base64Clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType || 'audio/wav' });

    const formData = new FormData();
    formData.append('file', blob, fileName || 'audio.wav');
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('response_format', 'json');

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!whisperRes.ok) {
      const err = await whisperRes.json().catch(() => null);
      throw new Error(err?.error?.message || `Whisper API failed with status ${whisperRes.status}`);
    }

    const data = await whisperRes.json();
    return new Response(JSON.stringify({ text: data.text }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: { message: error.message || 'Internal Server Error' } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
