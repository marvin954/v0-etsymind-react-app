import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured on server." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { systemPrompt, userPrompt, jsonMode } = body;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1000,
        system: jsonMode
          ? systemPrompt +
            "\n\nIMPORTANT: Your entire response must be a single valid JSON object. Do not include any text before or after the JSON. Do not use markdown code fences."
          : systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    const rawText = data.content
      .map((b: { text?: string }) => b.text || "")
      .join("")
      .trim();

    if (!jsonMode) {
      return NextResponse.json({ result: rawText });
    }

    // Aggressively extract JSON
    let jsonStr = rawText;
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    } else {
      const start = rawText.indexOf("{");
      const end = rawText.lastIndexOf("}");
      if (start !== -1 && end !== -1) jsonStr = rawText.slice(start, end + 1);
    }

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({ result: parsed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
