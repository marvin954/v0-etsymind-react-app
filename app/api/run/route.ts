import { NextRequest, NextResponse } from "next/server";
import {
  marketResearchAgent,
  productCreatorAgent,
  seoAgent,
  listingManagerAgent,
  analyticsAgent,
  publishListing,
} from "@/lib/agents";

// POST /api/run — manually trigger any agent from the dashboard
export async function POST(req: NextRequest) {
  const { agent, params } = await req.json();

  try {
    switch (agent) {
      case "analytics":
        return NextResponse.json({ result: await analyticsAgent() });

      case "market_research":
        return NextResponse.json({ result: await marketResearchAgent() });

      case "product_creator": {
        const products = await productCreatorAgent(params.niche || "digital planners", params.type || "digital");
        return NextResponse.json({ result: products });
      }

      case "seo": {
        const result = await seoAgent(params);
        return NextResponse.json({ result });
      }

      case "listing_manager":
        return NextResponse.json({ result: await listingManagerAgent() });

      case "publish": {
        const result = await publishListing(params);
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}