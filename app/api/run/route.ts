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


// ─── PRODUCT QUEUE (Supabase) ─────────────────────────────────────────────────
const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function sbGet(table: string, filter = "") {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}&order=created_at.asc`, {
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}` },
  });
  return res.json();
}

async function sbInsert(table: string, row: object) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: "POST",
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`, "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(row),
  });
  return res.json();
}

async function sbUpdate(table: string, updates: object, filter: string) {
  const res = await fetch(`${SB_URL()}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: { "apikey": SB_KEY(), "Authorization": `Bearer ${SB_KEY()}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

async function queueProducts(products: any[]) {
  const results = [];
  for (const p of products) {
    try {
      const row = await sbInsert("product_queue", {
        title: p.title,
        description: p.description,
        tags: p.tags,
        price: p.price,
        design_brief: p.design_brief,
        status: "pending",
        created_at: new Date().toISOString(),
      });
      results.push(row);
    } catch(e: any) { console.error("Queue insert failed:", e.message); }
  }
  return results;
}

async function processNextQueued(): Promise<any> {
  const rows = await sbGet("product_queue", "status=eq.pending&limit=1");
  if (!Array.isArray(rows) || !rows.length) return { message: "Queue is empty" };
  const item = rows[0];

  // Mark as processing
  await sbUpdate("product_queue", { status: "processing" }, `id=eq.${item.id}`);

  try {
    const result = await autonomousPublish(item);
    await sbUpdate("product_queue", { status: "published", listing_id: result.listing_id, published_at: new Date().toISOString() }, `id=eq.${item.id}`);
    return { ...result, queued_id: item.id };
  } catch(e: any) {
    await sbUpdate("product_queue", { status: "failed", error: e.message }, `id=eq.${item.id}`);
    throw e;
  }
}

async function getQueueStatus(): Promise<any> {
  const all = await sbGet("product_queue", "limit=50");
  if (!Array.isArray(all)) return { pending: 0, published: 0, failed: 0, items: [] };
  return {
    pending: all.filter((r: any) => r.status === "pending").length,
    processing: all.filter((r: any) => r.status === "processing").length,
    published: all.filter((r: any) => r.status === "published").length,
    failed: all.filter((r: any) => r.status === "failed").length,
    items: all.slice(0, 10),
  };
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


// ─── AI ASSET SPRINT — Generate real HTML digital product ─────────────────────
async function generateAssetHTML(title: string, niche: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 4000,
      system: `You are a professional digital product creator. Create a complete, valuable digital guide as a single JSON object. Return ONLY valid JSON, no markdown.`,
      messages: [{ role: "user", content: `Create a complete digital guide for: "${title}" in the ${niche} niche.

Return this exact JSON structure:
{
  "tagline": "one powerful transformation promise",
  "intro": "2 paragraph introduction",
  "sections": [
    {"title": "section title", "content": "200+ word actionable content"},
    {"title": "section title", "content": "200+ word actionable content"},
    {"title": "section title", "content": "200+ word actionable content"},
    {"title": "section title", "content": "200+ word actionable content"}
  ],
  "action_steps": ["step 1", "step 2", "step 3", "step 4", "step 5"],
  "bonus": "a valuable bonus tip"
}` }],
    }),
  }).then(r => r.json()).then(d => {
    const t = d.content[0].text;
    const m = t.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  });

  if (!res) throw new Error("Failed to generate content");

  const sectionsHTML = (res.sections || []).map((s: any, i: number) => `
    <section class="chapter">
      <div class="chapter-num">0${i+1}</div>
      <h2>${s.title}</h2>
      <div class="chapter-content">${s.content.split("\n").filter((p: string) => p.trim()).map((p: string) => `<p>${p}</p>`).join("")}</div>
    </section>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
:root{--gold:#f5a623;--dark:#0d0d15;--surface:#141420;--text:#e8e8f0;--dim:#64748b;--border:#1e1e2e}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--dark);color:var(--text);font-family:Georgia,serif;line-height:1.8}
.cover{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px 40px;background:linear-gradient(135deg,#0d0d15,#1a0a2e,#0d0d15);border-bottom:3px solid var(--gold)}
.cover-badge{font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.3em;color:var(--gold);background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);padding:6px 20px;margin-bottom:32px}
.cover h1{font-size:clamp(26px,5vw,48px);font-weight:400;color:#fff;line-height:1.2;margin-bottom:20px;max-width:800px}
.cover h1 em{color:var(--gold);font-style:normal}
.cover-tagline{font-size:17px;color:var(--dim);max-width:600px;margin-bottom:40px;font-style:italic}
.cover-divider{width:60px;height:2px;background:var(--gold);margin:0 auto 40px}
.cover-meta{font-family:'Courier New',monospace;font-size:10px;color:var(--dim);letter-spacing:0.2em}
.chapter{max-width:720px;margin:0 auto;padding:60px 40px;border-bottom:1px solid var(--border)}
.chapter-num{font-family:'Courier New',monospace;font-size:10px;color:var(--gold);letter-spacing:0.3em;margin-bottom:12px}
.chapter h2{font-size:26px;font-weight:400;color:#fff;margin-bottom:24px;line-height:1.3}
.chapter-content p{color:var(--dim);margin-bottom:16px;font-size:16px}
.chapter-content p:first-child{font-size:18px;color:var(--text)}
.intro{max-width:720px;margin:0 auto;padding:60px 40px;border-bottom:1px solid var(--border)}
.intro h2{font-size:26px;color:#fff;margin-bottom:20px}
.intro p{color:var(--dim);font-size:16px;margin-bottom:16px}
.action-plan{max-width:720px;margin:0 auto;padding:60px 40px;background:var(--surface);border-top:3px solid var(--gold);border-bottom:3px solid var(--gold)}
.action-plan h2{font-size:22px;color:var(--gold);margin-bottom:24px}
.steps{list-style:none;counter-reset:steps}
.steps li{counter-increment:steps;display:flex;gap:16px;margin-bottom:14px;padding:12px 16px;background:rgba(245,166,35,0.05);border-left:2px solid var(--gold);font-size:15px;color:var(--text)}
.steps li::before{content:counter(steps);font-family:'Courier New',monospace;font-size:11px;color:var(--gold);font-weight:800;flex-shrink:0;margin-top:2px}
.bonus{max-width:720px;margin:60px auto;padding:40px;background:linear-gradient(135deg,rgba(245,166,35,0.08),rgba(245,166,35,0.03));border:1px solid rgba(245,166,35,0.2)}
.bonus-badge{font-family:'Courier New',monospace;font-size:10px;color:var(--gold);letter-spacing:0.2em;margin-bottom:12px}
.bonus p{font-size:15px;color:var(--dim);line-height:1.7}
.footer{text-align:center;padding:40px;font-family:'Courier New',monospace;font-size:10px;color:var(--border);letter-spacing:0.2em}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-badge">DIGITAL GUIDE · INSTANT DOWNLOAD</div>
  <h1>${title}</h1>
  <div class="cover-tagline">${res.tagline}</div>
  <div class="cover-divider"></div>
  <div class="cover-meta">MVPDEALZ · ${new Date().getFullYear()}</div>
</div>
<div class="intro">
  <h2>Introduction</h2>
  ${res.intro.split("\n").filter((p: string) => p.trim()).map((p: string) => `<p>${p}</p>`).join("")}
</div>
${sectionsHTML}
<div class="action-plan">
  <h2>⚡ Your Action Plan</h2>
  <ol class="steps">
    ${(res.action_steps || []).map((s: string) => `<li>${s}</li>`).join("")}
  </ol>
</div>
<div class="bonus">
  <div class="bonus-badge">BONUS TIP</div>
  <p>${res.bonus}</p>
</div>
<div class="footer">© ${new Date().getFullYear()} MVPDEALZ · ALL RIGHTS RESERVED</div>
</body>
</html>`;
}


// Upload HTML file to Etsy listing
async function uploadHTMLToEtsy(listingId: string, htmlContent: string, filename: string, token: string): Promise<void> {
  const shopId = process.env.ETSY_SHOP_ID!;
  const fileBuffer = Buffer.from(htmlContent, "utf8");
  const boundary = "EtsyHTMLBoundary" + Date.now();
  const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: text/html\r\n\r\n`);
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
  if (!res.ok) throw new Error(`HTML file upload failed: ${await res.text()}`);
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

  // Generate real HTML product using AI Asset Sprint pipeline
  let fileUploaded = false;
  try {
    const htmlContent = await generateAssetHTML(product.title, product.category || "digital products");
    const filename = product.title.slice(0, 40).replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".html";
    await uploadHTMLToEtsy(listingId, htmlContent, filename, token);
    fileUploaded = true;
  } catch (e: any) { console.error("HTML product failed:", e.message); }

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

  // Publish first product immediately
  const first = products[0];
  log.push(`Publishing: ${first.title.slice(0, 50)}...`);
  try {
    const result = await autonomousPublish(first);
    published.push(result);
    log.push(`✓ ${result.status}: ${result.url}`);
  } catch (e: any) {
    log.push(`✗ Failed: ${e.message}`);
  }

  // Queue remaining 2 for later
  const remaining = products.slice(1);
  if (remaining.length > 0) {
    try {
      await queueProducts(remaining);
      log.push(`📋 ${remaining.length} products added to queue — run PROCESS QUEUE to publish`);
    } catch(e: any) {
      log.push(`Queue failed: ${e.message}`);
    }
  }

  return { log, published, total: published.length, queued: remaining.length };
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

      case "process_queue":
        return NextResponse.json({ result: await processNextQueued() });

      case "queue_status":
        return NextResponse.json({ result: await getQueueStatus() });

      default:
        return NextResponse.json({ error: `Unknown agent: ${agent}` }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
