import { NextRequest, NextResponse } from "next/server";
import { callHermes } from '@/lib/claude';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { systemPrompt, userPrompt, jsonMode, model = 'hermes-3-mini-128k' } = body;

  const response = await callHermes({
    model: model || 'hermes-3-mini-128k',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const result = response.choices && response.choices[0]?.message?.content
    ? response.choices[0].message.content
    : JSON.stringify(response);

  if (jsonMode) {
    try {
      return NextResponse.json({ result: JSON.parse(result) });
    } catch {
      return NextResponse.json({ error: 'Invalid JSON response' }, { status: 500 });
    }
  }

  return NextResponse.json({ result });
}
