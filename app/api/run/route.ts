import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function getValidToken(): Promise<string> {
  const current = process.env.ETSY_ACCESS_TOKEN!;
  // Try current token
  const test = await fetch(
    `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}`,
    { headers: { "x-api-key": process.env.ETSY_API_KEY!, "Authorization": `Bearer ${current}` } }
  );
  if (test.ok) return current;
  // Token expired — refresh it
  const res = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.ETSY_KEYSTRING!,
      refresh_token: process.env.ETSY_REFRESH_TOKEN!,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Token refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

function etsyHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    "x-api-key": process.env.ETSY_API_KEY!,
    "Authorization": `Bearer ${token}`,
  };
}

async function claude(system: string, user: string, maxTokens = 2000): Promise<any> {
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

async function generateMockupImage(title: string, designBrief: string): Promise<Buffer> {
  const prompt = `Professional Etsy digital product mockup for: "${title}". ${designBrief}. Clean white background, flat lay style, modern minimal design, showing a printed document or digital template preview. Professional product photography style. No text overlays.`;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error("DALL-E error: " + data.error.message);
  const imgRes = await fetch(data.data[0].url);
  const arrayBuffer = await imgRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadImageToEtsy(listingId: string, imageBuffer: Buffer, token: string): Promise<void> {
  const shopId = process.env.ETSY_SHOP_ID!;
  const boundary = "----EtsyImageBoundary" + Date.now();
  const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="mockup.png"\r\nContent-Type: image/png\r\n\r\n`);
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, imageBuffer, footer]);
  const res = await fetch(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`,
    {
      method: "POST",
      headers: {
        "x-api-key": process.env.ETSY_API_KEY!,
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`Image upload failed: ${await res.text()}`);
}

async function activateListing(listingId: string, token: string): Promise<void> {
  const shopId = process.env.ETSY_SHOP_ID!;
  const res = await fetch(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`,
    {
      method: "PATCH",
      headers: etsyHeaders(token),
      body: JSON.stringify({ state: "active" }),
    }
  );
  if (!res.ok) throw new Error(`Activation failed: ${await res.text()}`);
}

async function autonomousPublish(product: any): Promise<{
  listing_id: string;
  url: string;
  title: string;
  image_generated: boolean;
  status: string;
}> {
  const token = await getValidToken();
  const shopId = process.env.ETSY_SHOP_ID!;
  const priceNum = parseFloat((product.price || "4.99").toString().replace("$", "")) || 4.99;

  const createRes = await fetch(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings`,
    {
      method: "POST",
      headers: etsyHeaders(token),
      body: JSON.stringify({
        quantity: 999,
        title: product.title.slice(0, 140),
        description: product.description,
        price: priceNum,
        who_made: "i_did",
        when_made: "made_to_order",
        taxonomy_id: 2078,
        tags: (product.tags || []).slice(0, 13).map((t: string) => t.slice(0, 20)),
        is_digital: true,
        should_auto_renew: true,
        is_taxable: false,
        type: "download",
      }),
    }
  );

  const listing = await createRes.json();
  if (!createRes.ok || listing.error) throw new Error("Create listing failed: " + JSON.stringify(listing));

  const listingId = listing.listing_id;
  let imageGenerated = false;

  try {
    const imageBuffer = await generateMockupImage(
      product.title,
      product.design_brief || "Professional digital product mockup"
    );
    await uploadImageToEtsy(listingId, imageBuffer, token);
    imageGenerated = true;
  } catch (e: any) {
    console.error("Image failed:", e.message);
  }

  let status = "draft";
  if (imageGenerated) {
    try {
      await activateListing(listingId, token);
      status = "active";
    } catch (e: any) {
      console.error("Activation failed:", e.message);
      status = "draft_with_image";
    }
  }

  return {
    listing_id: listingId,
    url: `https://www.etsy.com/listing/${listingId}`,
    title: product.title,
    image_generated: imageGenerated,
    status,
  };
}

async function runFullPipeline(niche?: string): Promise<any> {
  const log: string[] = [];
  const targetNiche = niche || "Small Business Owner Tools";
  log.push(`Target niche: ${targetNiche}`);

  log.push("Creating products...");
  const products = await claude(
    `You are a product creation agent for an Etsy shop specializing in digital downloads. Create listings optimized for Etsy SEO. Keep descriptions under 400 characters. Respond ONLY with a valid JSON array.`,
    `Create 3 complete Etsy digital product listings for the "${targetNiche}" niche. Return JSON array: [{"title":"SEO title max 140 chars","description":"under 400 chars","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],"price":"$X.XX","design_brief":"max 50 words"}]. CRITICAL: every single tag must be 20 characters or less. Count the characters. No exceptions.`,
    2000
  );
  log.push(`Created ${products.length} products`);

  const published = [];
  const toPublish = products.slice(0, 1);
  for (const product of toPublish) {
    log.push(`Publishing: ${product.title.slice(0, 50)}...`);
    try {
      const result = await autonomousPublish(product);
      published.push(result);
      log.push(`✓ ${result.status}: ${result.url}`);
    } catch (e: any) {
      log.push(`✗ Failed: ${e.message}`);
    }
  }

  return { log, published, total: published.length };
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { agent, params } = await req.json();

  try {
    switch (agent) {

      case "full_pipeline":
        return NextResponse.json({ result: await runFullPipeline(params?.niche) });

      case "publish_one":
        return NextResponse.json({ result: await autonomousPublish(params) });

      case "analytics": {
        const token = await getValidToken();
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`,
          { headers: etsyHeaders(token) }
        );
        const data = await res.json();
        const listings = data.results || [];
        const totalViews = listings.reduce((s: number, l: any) => s + (l.views || 0), 0);
        const totalFavorites = listings.reduce((s: number, l: any) => s + (l.num_favorers || 0), 0);
        const reportRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 1000,
            system: "You are an analytics agent for an Etsy store. Give a concise report with health score, wins, problems, actions.",
            messages: [{ role: "user", content: `${listings.length} listings, ${totalViews} views, ${totalFavorites} favorites. Top: ${JSON.stringify(listings.slice(0, 3).map((l: any) => ({ title: l.title?.slice(0, 40), views: l.views })))}. Health score 0-100, top 3 problems, top 5 actions.` }],
          }),
        }).then(r => r.json()).then(d => d.content[0].text);
        return NextResponse.json({ result: { timestamp: new Date().toISOString(), listings_count: listings.length, total_views: totalViews, total_favorites: totalFavorites, report: reportRes } });
      }

      case "market_research": {
        const result = await claude(
          "You are a market research agent for Etsy. Find high-demand, low-competition niches for digital products. Respond ONLY with valid JSON.",
          `Find 5 trending Etsy niches for digital products right now. Return JSON: {"trending":[{"niche":"","demand":"high|medium","competition":"low|medium|high","products":[""],"avg_price":"","keywords":[""]}],"recommendations":[""]}`,
          1500
        );
        return NextResponse.json({ result });
      }

      case "product_creator": {
        const niche = params?.niche || "Small Business Tools";
        const result = await claude(
          "You are a product creation agent for Etsy. Create SEO-optimized listings. Keep descriptions under 400 chars. Respond ONLY with valid JSON array.",
          `Create 3 Etsy digital product listings for "${niche}". Return JSON array: [{"title":"max 140 chars","description":"max 400 chars","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],"price":"$X.XX","design_brief":"mockup image description max 50 words"}]`,
          2000
        );
        return NextResponse.json({ result });
      }

      case "listing_manager": {
        const token = await getValidToken();
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`,
          { headers: etsyHeaders(token) }
        );
        const data = await res.json();
        const listings = (data.results || []).map((l: any) => ({ id: l.listing_id, title: l.title?.slice(0, 60), views: l.views || 0, favorites: l.num_favorers || 0 }));
        if (!listings.length) return NextResponse.json({ result: [] });
        const result = await claude(
          "You are a listing manager. Respond ONLY with valid JSON array.",
          `Analyze and recommend actions: ${JSON.stringify(listings)}. Return: [{"listing_id":"","action":"refresh|optimize|boost","reason":"","priority":"high|medium|low"}]`,
          1000
        );
        return NextResponse.json({ result });
      }

      case "publish": {
        const token = await getValidToken();
        const product = params;
        const priceNum = parseFloat((product.price || "4.99").toString().replace("$", "")) || 4.99;
        const res = await fetch(
          `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings`,
          {
            method: "POST",
            headers: etsyHeaders(token),
            body: JSON.stringify({
              quantity: 999,
              title: product.title.slice(0, 140),
              description: product.description,
              price: priceNum,
              who_made: "i_did",
              when_made: "made_to_order",
              taxonomy_id: 2078,
              tags: (product.tags || []).slice(0, 13).map((t: string) => t.slice(0, 20)),
              is_digital: true,
              should_auto_renew: true,
              is_taxable: false,
              type: "download",
            }),
          }
        );
        const listing = await res.json();
        if (!res.ok) throw new Error(JSON.stringify(listing));
        return NextResponse.json({ result: { listing_id: listing.listing_id, url: `https://www.etsy.com/listing/${listing.listing_id}`, title: product.title } });
      }

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
