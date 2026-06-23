import { NextRequest, NextResponse } from "next/server";
export const maxDuration = 60;

async function getValidToken(): Promise<string> {
  const current = process.env.ETSY_ACCESS_TOKEN!;
  const test = await fetch(
    `https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}`,
    { headers: { "x-api-key": process.env.ETSY_API_KEY!, "Authorization": `Bearer ${current}` } }
  );
  if (test.ok) return current;

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
  const prompt = encodeURIComponent(
    `professional etsy digital product mockup, ${designBrief || title}, clean white background, flat lay, minimal design, no text, product photography`
  );
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadImageToEtsy(listingId: string, imageBuffer: Buffer, token: string): Promise<void> {
  const shopId = process.env.ETSY_SHOP_ID!;
  const boundary = "----EtsyBoundary" + Date.now();
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

async function generateProductPDF(title: string, designBrief: string): Promise<Buffer> {
  const productContent = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are a professional digital product creator. Create complete, valuable, ready-to-use content. Format with clean HTML using only h1, h2, p, ul, li tags.",
      messages: [{ role: "user", content: `Create full content for: "${title}". Type: ${designBrief}. Make it genuinely useful with 4-5 sections of actionable content.` }],
    }),
  }).then(r => r.json()).then(d => d.content[0].text);

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#1a1a1a;line-height:1.7;padding:20px}
    h1{font-size:22px;color:#1a1a1a;border-bottom:2px solid #f5a623;padding-bottom:10px;margin-bottom:20px}
    h2{font-size:17px;color:#374151;margin-top:28px;margin-bottom:10px}
    p{margin-bottom:14px;color:#374151}
    ul{padding-left:22px;margin-bottom:14px}
    li{margin-bottom:7px;color:#374151}
    .hdr{background:#1a1a1a;color:#f5a623;padding:20px;margin:-20px -20px 30px -20px}
    .hdr h1{color:#f5a623;border:none;margin:0;font-size:20px}
    .ftr{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
  </style></head><body>
  <div class="hdr"><h1>${title}</h1></div>
  ${productContent}
  <div class="ftr">mvpdealz · Digital Products for Entrepreneurs</div>
  </body></html>`;

  const pdfRes = await fetch("https://api.pdfshift.io/v3/convert/html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(`api:${process.env.PDFSHIFT_API_KEY}`).toString("base64")}`,
    },
    body: JSON.stringify({ source: html, landscape: false }),
  });
  if (!pdfRes.ok) throw new Error("PDF generation failed: " + await pdfRes.text());
  return Buffer.from(await pdfRes.arrayBuffer());
}

async function uploadFileToEtsy(listingId: string, fileBuffer: Buffer, filename: string, token: string): Promise<void> {
  const shopId = process.env.ETSY_SHOP_ID!;
  const boundary = "EtsyFileBoundary" + Date.now();
  const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/pdf\r\n\r\n`);
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, fileBuffer, footer]);
  const res = await fetch(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/files`,
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
  if (!res.ok) throw new Error(`File upload failed: ${await res.text()}`);
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

async function autonomousPublish(product: any): Promise<any> {
  const token = await getValidToken();
  const shopId = process.env.ETSY_SHOP_ID!;
  const priceNum = parseFloat((product.price || "4.99").toString().replace("$", "")) || 4.99;

  const createRes = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings`, {
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
  });

  const listing = await createRes.json();
  if (!createRes.ok || listing.error) throw new Error("Create listing failed: " + JSON.stringify(listing));
  const listingId = listing.listing_id;

  let imageGenerated = false;
  let fileUploaded = false;

  try {
    const imgBuf = await generateMockupImage(product.title, product.design_brief || product.title);
    await uploadImageToEtsy(listingId, imgBuf, token);
    imageGenerated = true;
  } catch (e: any) { console.error("Image failed:", e.message); }

  try {
    const pdfBuf = await generateProductPDF(product.title, product.design_brief || product.title);
    const fname = product.title.slice(0, 40).replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".pdf";
    await uploadFileToEtsy(listingId, pdfBuf, fname, token);
    fileUploaded = true;
  } catch (e: any) { console.error("PDF failed:", e.message); }

  let status = "draft";
  if (imageGenerated) {
    try { await activateListing(listingId, token); status = "active"; }
    catch (e: any) { status = "draft_with_image"; }
  }

  return { listing_id: listingId, url: `https://www.etsy.com/listing/${listingId}`, title: product.title, image_generated: imageGenerated, file_uploaded: fileUploaded, status };
}

// ─── FIX IMAGES: upload image to all listings missing one ─────────────────────
async function fixMissingImages(): Promise<any> {
  const token = await getValidToken();
  const shopId = process.env.ETSY_SHOP_ID!;
  const log: string[] = [];

  // Get all active listings with their images
  const res = await fetch(
    `https://api.etsy.com/v3/application/shops/${shopId}/listings?state=active&limit=100&includes=images`,
    { headers: etsyHeaders(token) }
  );
  const data = await res.json();
  const listings = data.results || [];
  log.push(`Found ${listings.length} active listings`);

  // Filter to ones missing images
  const missing = listings.filter((l: any) => !l.images || l.images.length === 0);
  log.push(`${missing.length} listings missing images`);

  if (!missing.length) return { log, fixed: 0, message: "All listings already have images!" };

  // Fix up to 3 per run (timeout limit)
  const toFix = missing.slice(0, 3);
  let fixed = 0;

  for (const listing of toFix) {
    log.push(`Generating image for: ${listing.title.slice(0, 50)}...`);
    try {
      const imgBuf = await generateMockupImage(listing.title, listing.title);
      await uploadImageToEtsy(listing.listing_id, imgBuf, token);
      fixed++;
      log.push(`✓ Image uploaded to listing #${listing.listing_id}`);
    } catch (e: any) {
      log.push(`✗ Failed #${listing.listing_id}: ${e.message}`);
    }
  }

  const remaining = missing.length - toFix.length;
  if (remaining > 0) log.push(`${remaining} more listings still need images — run again`);

  return { log, fixed, total_missing: missing.length, remaining };
}

async function runFullPipeline(niche?: string): Promise<any> {
  const log: string[] = [];
  const targetNiche = niche || "Small Business Owner Tools";
  log.push(`Target niche: ${targetNiche}`);
  log.push("Creating products...");

  const products = await claude(
    `You are a product creation agent for an Etsy shop specializing in digital downloads. Create listings optimized for Etsy SEO. Keep descriptions under 400 characters. Respond ONLY with a valid JSON array.`,
    `Create 3 complete Etsy digital product listings for the "${targetNiche}" niche. Return JSON array: [{"title":"SEO title max 140 chars","description":"under 400 chars","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],"price":"$X.XX","design_brief":"max 50 words"}]. CRITICAL: every single tag must be 20 characters or less.`,
    2000
  );
  log.push(`Created ${products.length} products`);

  const published = [];
  for (const product of products.slice(0, 2)) {
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
      case "fix_images":
        return NextResponse.json({ result: await fixMissingImages() });
      case "publish_one":
        return NextResponse.json({ result: await autonomousPublish(params) });

      case "analytics": {
        const token = await getValidToken();
        const res = await fetch(`https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`, { headers: etsyHeaders(token) });
        const data = await res.json();
        const listings = data.results || [];
        const totalViews = listings.reduce((s: number, l: any) => s + (l.views || 0), 0);
        const totalFaves = listings.reduce((s: number, l: any) => s + (l.num_favorers || 0), 0);
        const rpt = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: "You are an analytics agent for an Etsy store. Give a concise report with health score, wins, problems, actions.", messages: [{ role: "user", content: `${listings.length} listings, ${totalViews} views, ${totalFaves} favorites. Health score 0-100, top 3 problems, top 5 actions.` }] }),
        }).then(r => r.json()).then(d => d.content[0].text);
        return NextResponse.json({ result: { timestamp: new Date().toISOString(), listings_count: listings.length, total_views: totalViews, total_favorites: totalFaves, report: rpt } });
      }

      case "market_research": {
        const result = await claude(
          "You are a market research agent for Etsy. Respond ONLY with valid JSON.",
          `Find 5 trending Etsy niches for digital products. Return JSON: {"trending":[{"niche":"","demand":"high|medium","competition":"low|medium|high","products":[""],"avg_price":"","keywords":[""]}],"recommendations":[""]}`,
          1500
        );
        return NextResponse.json({ result });
      }

      case "product_creator": {
        const niche = params?.niche || "Small Business Tools";
        const result = await claude(
          "You are a product creation agent for Etsy. Keep descriptions under 400 chars. Respond ONLY with valid JSON array.",
          `Create 3 Etsy digital product listings for "${niche}". Return JSON array: [{"title":"max 140 chars","description":"max 400 chars","tags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],"price":"$X.XX","design_brief":"max 50 words"}]`,
          2000
        );
        return NextResponse.json({ result });
      }

      case "listing_manager": {
        const token = await getValidToken();
        const res = await fetch(`https://api.etsy.com/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings?state=active&limit=100`, { headers: etsyHeaders(token) });
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

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
