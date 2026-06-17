import { NextRequest, NextResponse } from "next/server";
import {
  marketResearchAgent,
  productCreatorAgent,
  seoAgent,
  listingManagerAgent,
  analyticsAgent,
  publishListing,
} from "@/lib/agents";

export const maxDuration = 300; // 5 min max

export async function GET(req: NextRequest) {
  // Verify cron secret so it can only be triggered by Vercel
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log: string[] = [];
  const results: Record<string, any> = {};

  try {
    log.push(`[${new Date().toISOString()}] AIOS-50 Daily Run Started`);

    // ── STEP 1: Analytics — understand where we are ────────────────────────
    log.push("Running Analytics Agent...");
    const analytics = await analyticsAgent();
    results.analytics = analytics;
    log.push(`Analytics complete. Listings: ${analytics.listings_count}, Views: ${analytics.total_views}`);

    // ── STEP 2: Market Research — find opportunities ────────────────────────
    log.push("Running Market Research Agent...");
    const research = await marketResearchAgent();
    results.research = research;
    log.push(`Research complete. Found ${research.trending.length} trending niches`);

    // ── STEP 3: Create & publish new listings (2 per day max) ──────────────
    if (research.trending.length > 0) {
      const topNiche = research.trending[0];
      log.push(`Creating products for niche: ${topNiche.niche}`);

      const products = await productCreatorAgent(topNiche.niche, "digital");
      results.products_created = products.length;

      // Publish top 2 products
      const toPublish = products.slice(0, 2);
      const published = [];

      for (const product of toPublish) {
        try {
          // SEO optimize before publishing
          const seoOptimized = await seoAgent({
            title: product.title,
            description: product.description,
            tags: product.tags,
            price: product.price,
            category: product.category,
          });

          const optimizedProduct = {
            ...product,
            title: seoOptimized.optimized_title,
            description: seoOptimized.optimized_description,
            tags: seoOptimized.optimized_tags,
            price: seoOptimized.suggested_price || product.price,
          };

          const result = await publishListing(optimizedProduct);
          published.push(result);
          log.push(`Published listing: ${result.listing_id} — ${optimizedProduct.title.slice(0, 50)}...`);
        } catch (e: any) {
          log.push(`Failed to publish: ${e.message}`);
        }
      }

      results.published = published;
    }

    // ── STEP 4: Listing Manager — optimize existing listings ────────────────
    log.push("Running Listing Manager Agent...");
    const actions = await listingManagerAgent();
    results.listing_actions = actions;
    log.push(`Listing manager: ${actions.length} actions recommended`);

    log.push(`[${new Date().toISOString()}] AIOS-50 Daily Run Complete`);

    return NextResponse.json({
      success: true,
      log,
      results,
      next_run: "Tomorrow at 9am UTC",
    });

  } catch (e: any) {
    log.push(`ERROR: ${e.message}`);
    return NextResponse.json({ success: false, log, error: e.message }, { status: 500 });
  }
}