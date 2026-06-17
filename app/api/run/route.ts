import { NextRequest, NextResponse } from "next/server";

async function callClaude(system: string, user: string, maxTokens = 2000): Promise<any> {
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
  const text = data.content[0].text;
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

function getEtsyHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.ETSY_API_KEY!,
    "Authorization": `Bearer ${process.env.ETSY_ACCESS_TOKEN!}`,
  };
}

export async function POST(req: NextRequest) {
  const { agent, params } = await req.json();

  try {
    switch (agent) {

      case "analytics": {
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`,
          { headers: getEtsyHeaders() }
        );
        const data = await res.json();
        const listings = data.results || [];
        const totalViews = listings.reduce((s: number, l: any) => s + (l.views || 0), 0);
        const totalFavorites = listings.reduce((s: number, l: any) => s + (l.num_favorers || 0), 0);

        const report = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 1500,
            system: "You are an analytics agent for an Etsy store. Provide a concise performance report with health score, wins, problems, and actions.",
            messages: [{ role: "user", content: `Store: ${listings.length} listings, ${totalViews} views, ${totalFavorites} favorites. Top listings: ${JSON.stringify(listings.slice(0, 3).map((l: any) => ({ title: l.title, views: l.views })))}. Give health score 0-100, top 3 wins, top 3 problems, top 5 actions.` }],
          }),
        }).then(r => r.json()).then(d => d.content[0].text);

        return NextResponse.json({ result: { timestamp: new Date().toISOString(), listings_count: listings.length, total_views: totalViews, total_favorites: totalFavorites, report } });
      }

      case "market_research": {
        const result = await callClaude(
          "You are a market research agent for an Etsy store selling digital products and POD. Identify trending niches with high demand and low competition. Respond ONLY with valid JSON, no markdown.",
          `Identify 5 trending Etsy niches right now. Return JSON: {"trending":[{"niche":"","demand":"high|medium","competition":"low|medium|high","products":["",""],"avg_price":"","keywords":["",""]}],"recommendations":["action1","action2"]}`,
          1500
        );
        return NextResponse.json({ result });
      }

      case "product_creator": {
        const niche = params?.niche || "Small Business Tools";
        const type = params?.type || "digital";
        const result = await callClaude(
          `You are a product creation agent for an Etsy shop. Create complete listings optimized for Etsy SEO. Keep descriptions under 500 characters. Respond ONLY with valid JSON array, no markdown.`,
          `Create 3 Etsy listings for "${niche}" niche, type: ${type}. Return JSON array: [{"title":"SEO title max 140 chars","description":"product description max 400 chars","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],"price":"$X.XX","category":"Digital Downloads","design_brief":"what the product contains"}]`,
          2000
        );
        return NextResponse.json({ result });
      }

      case "publish": {
        const product = params;
        const priceNum = parseFloat((product.price || "4.99").replace("$", "")) || 4.99;
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings`,
          {
            method: "POST",
            headers: getEtsyHeaders(),
            body: JSON.stringify({
              quantity: 999,
              title: product.title.slice(0, 140),
              description: product.description,
              price: priceNum,
              who_made: "i_did",
              when_made: "made_to_order",
              taxonomy_id: 2078,
              tags: (product.tags || []).slice(0, 13),
              is_digital: true,
              should_auto_renew: true,
              is_taxable: false,
              type: "download",
            }),
          }
        );
        const listing = await res.json();
        if (listing.error) throw new Error(listing.error);
        return NextResponse.json({ result: { listing_id: listing.listing_id, url: `https://www.etsy.com/listing/${listing.listing_id}`, title: product.title } });
      }

      case "listing_manager": {
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`,
          { headers: getEtsyHeaders() }
        );
        const data = await res.json();
        const listings = (data.results || []).map((l: any) => ({ id: l.listing_id, title: l.title, views: l.views || 0, favorites: l.num_favorers || 0 }));
        if (!listings.length) return NextResponse.json({ result: [] });
        const result = await callClaude(
          "You are a listing management agent. Analyze Etsy listings and recommend actions. Respond ONLY with valid JSON array.",
          `Analyze: ${JSON.stringify(listings)}. Return JSON array: [{"listing_id":"","action":"refresh|optimize|boost","reason":"","priority":"high|medium|low"}]`,
          1000
        );
        return NextResponse.json({ result });
      }

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}