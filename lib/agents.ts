// lib/agents.ts — Hermes LLM bridge
// All 6 agents (market research, SEO, product creator, listing manager, pricing, analytics)
// use direct fetch() to the Hermes proxy

import { callHermes, ClaudeMessage } from './claude';

export interface AgentOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

const DEFAULT_MODEL = 'hermes-3-mini-128k';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;

// API proxy helper
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'AI-Proxy-KEY': process.env.AI_PROXY_KEY || process.env.HERMES_API_KEY || 'default-key',
      'AI-Proxy-Version': '2024-06-01',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

// Market research agent
export async function marketResearch(productName: string, targetAudience: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are a market research expert. Analyze the product and provide insights.',
    },
    {
      role: 'user',
      content: `Product: ${productName}. Target audience: ${targetAudience}. Provide market analysis, trends, and recommendations.`,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}

// SEO agent
export async function seo(content: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are an SEO expert. Optimize content for search engines.',
    },
    {
      role: 'user',
      content: content,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}

// Product creator agent
export async function productCreator(idea: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are a product creator expert.',
    },
    {
      role: 'user',
      content: idea,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}

// Listing manager agent
export async function listingManager(listing: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are a listing manager expert.',
    },
    {
      role: 'user',
      content: listing,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}

// Pricing agent
export async function pricing(product: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are a pricing expert.',
    },
    {
      role: 'user',
      content: product,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}

// Analytics agent
export async function analytics(data: string, model: string = DEFAULT_MODEL): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'system',
      content: 'You are an analytics expert.',
    },
    {
      role: 'user',
      content: data,
    },
  ];

  const response = await callHermes({ model, messages, temperature: DEFAULT_TEMPERATURE, max_tokens: DEFAULT_MAX_TOKENS });
  return response.choices[0]?.message?.content || '';
}
