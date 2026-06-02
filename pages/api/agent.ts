import type { NextApiRequest, NextApiResponse } from "next";

type ResponseData =
  | { result?: unknown; error?: string }
  | { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured on server.",
    });
  }

  try {
    const { systemPrompt, userPrompt, jsonMode } = req.body;

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
          ? systemPrompt +
            "\n\nIMPORTANT: Your entire response must be a single valid JSON object. Do not include any text before or after the JSON. Do not use markdown code fences."
          : systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const result = data.content[0]?.text || "";

    if (jsonMode) {
      try {
        const json = JSON.parse(result);
        return res.status(200).json({ result: json });
      } catch {
        return res.status(400).json({ error: "Invalid JSON response from AI" });
      }
    }

    return res.status(200).json({ result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
}
