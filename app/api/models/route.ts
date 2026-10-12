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

      // Filter to Hermes free models
      const free = models
        .filter((m: any) => m.owned_by === "NousResearch" || m.id.includes("hermes"))
        .map((m: any) => ({
          id: m.id,
          label: m.name || m.id,
          free: true,
        }));

      return NextResponse.json({ models: [...free, ...HERMES_FREE_MODELS] });
    }

    // Fallback to known free models
    return NextResponse.json({
      models: [
        ...HERMES_FREE_MODELS,
        { id: "upstage/solar-mini4", label: "Solar Mini 4", free: true },
        { id: "upstage/solar-pro4", label: "Solar Pro 4", free: true },
      ],
    });
  } catch {
    // Fallback
    return NextResponse.json({
      models: [
        ...HERMES_FREE_MODELS,
        { id: "upstage/solar-mini4", label: "Solar Mini 4", free: true },
        { id: "upstage/solar-pro4", label: "Solar Pro 4", free: true },
      ],
    });
  }
}
