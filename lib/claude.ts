// lib/claude.ts — Hermes proxy wrapper
// Routes all AI calls to the Hermes proxy
import { promises as fs } from 'fs';

export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ClaudeResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ClaudeMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const HERMES_PROXY_URL = process.env.HERMES_PROXY_URL || 'https://inference-api.nousresearch.com/v1/chat/completions';
const AI_PROXY_KEY = process.env.AI_PROXY_KEY || process.env.HERMES_API_KEY || 'default-key';

export async function callHermes(request: ClaudeRequest): Promise<ClaudeResponse> {
  const response = await fetch(HERMES_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'AI-Proxy-KEY': AI_PROXY_KEY,
      'AI-Proxy-Version': '2024-06-01',
    },
    body: JSON.stringify({
      ...request,
      model: request.model || 'hermes-3-mini-128k',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Hermes proxy error: ${response.status} ${errorText}`);
  }

  return response.json();
}

export function formatConversation(messages: ClaudeMessage[]): string {
  return messages.map(m => `${m.role}: ${m.content}`).join('\n');
}
