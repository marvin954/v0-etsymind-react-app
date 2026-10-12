import { NextRequest, NextResponse } from "next/server";

// Hermes free model list for the dropdown
const HERMES_FREE_MODELS = [
  "hermes-3-mini-128k",
  "hermes-3-mini-400k",
  "hermes-3-mini-1m",
  "hermes-3-mini-4m",
  "auto/best-coding",
  "auto/best-reasoning",
];

export async function GET(request: NextRequest) {
  // Fetch from inference-api to get the actual list
  try {
    const res = await fetch("https://inference-api.nousresearch.com/v1/models", {
      headers: {
        "AI-Proxy-KEY": process.env.AI_PROXY_KEY || "default-key",
        "AI-Proxy-Version": "2024-06-01",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      const models = data.data || [];

      // Return array of strings
      const hermes = models
        .filter((m: any) => m.owned_by === "NousResearch" || m.id.includes("hermes"))
        .map((m: any) => m.id);

      return NextResponse.json([...hermes, ...HERMES_FREE_MODELS]);
    }

    // Fallback to known free models
    return NextResponse.json([...HERMES_FREE_MODELS]);
  } catch {
    // Fallback
    return NextResponse.json([...HERMES_FREE_MODELS]);
  }
}
