import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { systemPrompt, userPrompt, jsonMode } = req.body;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        system: jsonMode
          ? systemPrompt + "\n\nIMPORTANT: Your entire response must be a single valid JSON object. No markdown, no backticks, no extra text."
          : systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok || data.error) return res.status(response.status).json({ error: data?.error?.message || JSON.stringify(data) });

    const rawText = data.content.map((b: { text?: string }) => b.text || "").join("").trim();
    if (!jsonMode) return res.status(200).json({ result: rawText });

    let jsonStr = rawText;
    const fenceMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    else {
      const start = rawText.indexOf("{"), end = rawText.lastIndexOf("}");
      if (start !== -1 && end !== -1) jsonStr = rawText.slice(start, end + 1);
    }
    return res.status(200).json({ result: JSON.parse(jsonStr) });
  } catch (e: unknown) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
}
