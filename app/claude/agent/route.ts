import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, userPrompt, jsonMode } = await request.json();

    const fullSystemPrompt = jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: Your entire response must be a single valid JSON object. Do not include any text before or after the JSON. Do not use markdown code fences.`
      : systemPrompt;

    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5"),
      system: fullSystemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 1000,
    });

    if (!jsonMode) {
      return NextResponse.json({ result: text });
    }

    // Parse JSON response
    let jsonStr = text.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
    }

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({ result: parsed });
  } catch (error) {
    console.error("Claude API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
