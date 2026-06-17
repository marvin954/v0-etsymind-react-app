// Claude AI agent helper

export async function runAgent(system: string, user: string, maxTokens = 2000): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

export async function runAgentJSON<T>(system: string, user: string, maxTokens = 2000): Promise<T> {
  const text = await runAgent(
    system + "\n\nRespond ONLY with valid JSON. No markdown, no explanation.",
    user,
    maxTokens
  );
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON found in response: " + text.slice(0, 200));
  return JSON.parse(match[0]) as T;
}