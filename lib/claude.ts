// lib/claude.ts — Hermes proxy wrapper
const HERMES_PROXY_URL = process.env.HERMES_PROXY_URL || 'https://inference-api.nousresearch.com/v1/chat/completions';
const AI_PROXY_KEY = process.env.AI_PROXY_KEY || process.env.HERMES_API_KEY || 'default-key';

export async function callHermes(request: any): Promise<any> {
  const response = await fetch(HERMES_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AI-Proxy-KEY': AI_PROXY_KEY,
      'AI-Proxy-Version': '2024-06-01',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hermes proxy error: ${response.status} ${errorText}`);
  }
  return response.json();
}
