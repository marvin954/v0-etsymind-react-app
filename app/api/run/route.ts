import { callHermes } from '@/lib/claude';

export async function POST(request: Request) {
  const body = await request.json();
  const { messages, model = 'hermes-3-mini-128k', temperature = 0.7, max_tokens = 2048 } = body;
  const response = await callHermes({ model, messages, temperature, max_tokens });
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
