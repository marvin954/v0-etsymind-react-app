import { callHermes } from '@/lib/claude';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const { messages, model = 'hermes-3-mini-128k' } = body;
  const result = await callHermes({ model, messages });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
