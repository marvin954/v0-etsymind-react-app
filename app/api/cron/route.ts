import { NextRequest, NextResponse } from "next/server";

// Runs every day at 9am UTC (set in vercel.json)
// Fully autonomous: research → create → optimize → save → email
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const log: string[] = [];

  try {
    log.push(`[${new Date().toISOString()}] Daily pipeline started`);

    // 1. RESEARCH
    const researchRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are a Market Research AI for an Etsy store. Output actionable JSON insights about trending digital products.",
        userPrompt: `Research the best digital product niches on Etsy right now.
Output JSON: {
  "trending_keywords": ["kw1","kw2","kw3","kw4","kw5"],
  "product_opportunities": [
    { "product": "...", "reason": "...", "estimated_price": "$X-$Y", "competition": "low|medium|high", "demand": "low|medium|high" }
  ],
  "competitor_insights": "...",
  "recommended_focus": "..."
}`,
        jsonMode: true,
      }),
    });
    const { result: research } = await researchRes.json();
    log.push(`Research done: ${research?.product_opportunities?.length || 0} opportunities found`);

    // 2. CREATE PRODUCT
    const idea = research?.product_opportunities?.[0]?.product || "Minimalist Digital Planner";
    const keywords = research?.trending_keywords || ["printable", "digital", "planner"];

    const creatorRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are a Product Creator AI for an Etsy digital products store. Create complete, ready-to-publish product listings.",
        userPrompt: `Create a complete Etsy listing for: "${idea}"
Target keywords: ${JSON.stringify(keywords)}
Output JSON: {
  "title": "SEO-optimized title (max 140 chars)",
  "description": "3-paragraph compelling description",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],
  "price": "$X.XX",
  "category": "Etsy category",
  "files_included": ["file1.pdf"],
  "mockup_prompt": "detailed image generation prompt"
}`,
        jsonMode: true,
      }),
    });
    const { result: product } = await creatorRes.json();
    log.push(`Product created: "${product?.title?.slice(0, 50)}..."`);

    // 3. OPTIMIZE LISTING
    const listingRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are a Listing Manager AI for an Etsy store. Optimize listings for maximum visibility and conversion.",
        userPrompt: `Optimize this Etsy listing: ${JSON.stringify(product)}
Output JSON: {
  "seo_score": 85,
  "optimizations": ["improvement 1", "improvement 2", "improvement 3"],
  "price_recommendation": "$X.XX",
  "title_variant": "alternative A/B test title",
  "top_tags_to_add": ["tag1", "tag2"],
  "listing_status": "ready|needs_work",
  "predicted_monthly_sales": "X-Y units"
}`,
        jsonMode: true,
      }),
    });
    const { result: listing } = await listingRes.json();
    log.push(`Listing optimized: SEO score ${listing?.seo_score}/100`);

    // 4. ANALYTICS
    const analyticsRes = await fetch(`${base}/api/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt: "You are an Analytics AI for an Etsy store. Provide actionable data-driven insights.",
        userPrompt: `Generate a daily analytics report for an Etsy digital products store.
Today's new product: ${JSON.stringify(product)}
Output JSON: {
  "revenue_this_month": "$X,XXX",
  "revenue_trend": "+X%",
  "top_performers": [{ "product": "...", "units": 0, "revenue": "$XXX" }],
  "underperformers": [{ "product": "...", "issue": "...", "action": "..." }],
  "conversion_rate": "X.X%",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "next_actions": ["action 1", "action 2"]
}`,
        jsonMode: true,
      }),
    });
    const { result: analytics } = await analyticsRes.json();
    log.push(`Analytics done: ${analytics?.revenue_this_month} revenue`);

    // 5. SAVE TO DATABASE
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await fetch(`${base}/api/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "listings",
          record: {
            title: product?.title,
            description: product?.description,
            price: product?.price,
            category: product?.category,
            tags: product?.tags,
            seo_score: listing?.seo_score,
            listing_status: listing?.listing_status,
            predicted_sales: listing?.predicted_monthly_sales,
            source: "autonomous_cron",
          },
        }),
      });

      await fetch(`${base}/api/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "analytics",
          record: {
            revenue_this_month: analytics?.revenue_this_month,
            revenue_trend: analytics?.revenue_trend,
            conversion_rate: analytics?.conversion_rate,
            key_insights: analytics?.key_insights,
            next_actions: analytics?.next_actions,
            run_date: new Date().toISOString(),
          },
        }),
      });
      log.push("Data saved to Supabase");
    }

    // 6. SEND EMAIL REPORT
    if (process.env.RESEND_API_KEY && process.env.REPORT_EMAIL) {
      await fetch(`${base}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `EtsyMind AI Daily Report — ${new Date().toDateString()}`,
          analyticsData: analytics,
          listings: product ? [product] : [],
          createdProducts: product ? [product] : [],
        }),
      });
      log.push(`Email report sent to ${process.env.REPORT_EMAIL}`);
    }

    log.push(`[${new Date().toISOString()}] Pipeline complete ✅`);

    return NextResponse.json({
      success: true,
      log,
      summary: {
        product_created: product?.title,
        seo_score: listing?.seo_score,
        revenue: analytics?.revenue_this_month,
        email_sent: !!process.env.RESEND_API_KEY,
        db_saved: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    log.push(`ERROR: ${msg}`);
    return NextResponse.json({ error: msg, log }, { status: 500 });
  }
}
