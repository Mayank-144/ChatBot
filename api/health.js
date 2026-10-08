export const config = {
  runtime: 'edge',
};

export default function handler() {
  return new Response(
    JSON.stringify({
      status: 'online',
      service: 'Mayank AI ChatBot Backend API (Vercel Serverless & Edge)',
      version: '2.0.0',
      activeTools: ['get_weather', 'wikipedia_search', 'calculator', 'get_time'],
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
