import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`)
    return res.status(401).json({ error: "Unauthorized" });

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const log: string[] = [];

  try {
    log.push(`[${new Date().toISOString()}] Daily pipeline started`);

    // 1. Research
    const researchRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are a Market Research AI for an Etsy store. Output actionable JSON insights.",
        userPrompt: `Research the best digital product niches on Etsy right now.
Output JSON: { "trending_keywords": ["kw1","kw2","kw3","kw4","kw5"], "product_opportunities": [{ "product": "...", "reason": "...", "estimated_price": "$X-$Y", "competition": "low|medium|high", "demand": "low|medium|high" }], "competitor_insights": "...", "recommended_focus": "..." }`,
        jsonMode: true,
      }),
    });
    const { result: research } = await researchRes.json();
    log.push(`Research: ${research?.product_opportunities?.length || 0} opportunities`);

    // 2. Create product
    const idea = research?.product_opportunities?.[0]?.product || "Minimalist Digital Planner";
    const keywords = research?.trending_keywords || ["printable", "digital", "planner"];
    const creatorRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are a Product Creator AI for an Etsy digital products store. Output ready-to-publish JSON.",
        userPrompt: `Create a listing for: "${idea}"\nKeywords: ${JSON.stringify(keywords)}\nOutput JSON: { "title": "...", "description": "...", "tags": ["..."], "price": "$X.XX", "category": "...", "files_included": ["..."], "mockup_prompt": "..." }`,
        jsonMode: true,
      }),
    });
    const { result: product } = await creatorRes.json();
    log.push(`Product: "${product?.title?.slice(0, 50)}"`);

    // 3. Generate mockup image
    let mockupUrl = null;
    if (process.env.OPENAI_API_KEY && product?.mockup_prompt) {
      const imgRes = await fetch(`${base}/api/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: product.mockup_prompt }),
      });
      const imgData = await imgRes.json();
      mockupUrl = imgData.url || null;
      log.push(`Mockup: ${mockupUrl ? "generated" : "failed"}`);
    }

    // 4. Publish to Etsy
    let etsyListingId = null;
    if (process.env.ETSY_ACCESS_TOKEN && process.env.ETSY_SHOP_ID) {
      const etsyRes = await fetch(`${base}/api/etsy/listings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const etsyData = await etsyRes.json();
      etsyListingId = etsyData.listing_id || null;
      log.push(`Etsy listing: ${etsyListingId ? `published #${etsyListingId}` : "failed"}`);
    }

    // 5. Analytics
    const analyticsRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are an Analytics AI for an Etsy store.",
        userPrompt: `Generate a daily analytics report.\nNew product: ${JSON.stringify(product)}\nOutput JSON: { "revenue_this_month": "$X,XXX", "revenue_trend": "+X%", "top_performers": [], "underperformers": [], "conversion_rate": "X.X%", "key_insights": ["..."], "next_actions": ["..."] }`,
        jsonMode: true,
      }),
    });
    const { result: analytics } = await analyticsRes.json();
    log.push(`Analytics: ${analytics?.revenue_this_month}`);

    // 6. Save to Supabase
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      await fetch(`${base}/api/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "listings",
          record: { title: product?.title, price: product?.price, tags: product?.tags, description: product?.description, mockup_url: mockupUrl, etsy_listing_id: etsyListingId, status: etsyListingId ? "published" : "draft", source: "cron" },
        }),
      });
      log.push("Saved to Supabase");
    }

    // 7. Send email report
    if (process.env.RESEND_API_KEY) {
      await fetch(`${base}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `EtsyMind AI Daily Report — ${new Date().toDateString()}`,
          analyticsData: analytics,
          createdProducts: product ? [product] : [],
        }),
      });
      log.push("Email sent");
    }

    log.push(`[${new Date().toISOString()}] Pipeline complete ✅`);
    return res.status(200).json({ success: true, log, etsy_listing_id: etsyListingId, mockup_url: mockupUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    log.push(`ERROR: ${msg}`);
    return res.status(500).json({ error: msg, log });
  }
}
