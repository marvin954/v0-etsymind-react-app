// lib/etsy-agents.ts — Etsy-specific agents
// Uses /api/claude which routes to the Hermes proxy

import { callHermes, ClaudeMessage, ClaudeRequest } from './claude';

// Climate agent
export async function researchClimate(agentId: string): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: `Research climate data for agent ${agentId}.`,
    },
  ];

  const response = await callHermes({ model: 'hermes-3-mini-128k', messages });
  return response.choices[0]?.message?.content || '';
}

// Analytics agent
export async function runAnalytics(agentId: string, data: string): Promise<any> {
  const messages: ClaudeMessage[] = [
    {
      role: 'user',
      content: `Analyze climate data for agent ${agentId}: ${data}`,
    },
  ];

  const response = await callHermes({ model: 'hermes-3-mini-128k', messages });
  return response.choices[0]?.message?.content || '';
}
