import { callHermes } from '@/lib/claude';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt, jsonMode, model = 'hermes-3-mini-128k' } = await request.json();

    const { text } = await callHermes({
      model: model || 'hermes-3-mini-128k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const result = text || JSON.stringify({});
    if (jsonMode) {
      try {
        return NextResponse.json({ result: JSON.parse(result) });
      } catch {
        return NextResponse.json({ error: 'Invalid JSON response' }, { status: 500 });
      }
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Claude agent error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
