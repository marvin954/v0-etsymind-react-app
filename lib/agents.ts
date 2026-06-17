import { runAgent, runAgentJSON } from "./claude";
import { etsyGet, etsyPost, etsyPatch, SHOP_ID } from "./etsy";

// ─── AGENT 1: MARKET RESEARCH ─────────────────────────────────────────────────
export async function marketResearchAgent(): Promise<{
  trending: TrendingNiche[];
  recommendations: string[];
}> {
  // Get current listings to understand what's already in the store
  const { results: listings } = await etsyGet(
    `/application/shops/${SHOP_ID}/listings?state=active&limit=25`
  ).catch(() => ({ results: [] }));

  const existingTitles = listings.map((l: any) => l.title).join(", ") || "none yet";

  return runAgentJSON(
    `You are a market research agent for an Etsy store selling digital products and print-on-demand items.
Your job is to identify trending niches and product opportunities that will generate sales.
Focus on: digital downloads (PDFs, templates, planners, guides, SVGs), and POD products (t-shirts, mugs, tote bags, phone cases).
Current store listings: ${existingTitles}
Research high-demand, low-competition niches on Etsy right now.`,
    `Identify 5 trending Etsy niches for digital products and POD right now. For each niche provide specific product ideas.
Return JSON: { "trending": [{"niche": "", "demand": "high|medium", "competition": "low|medium|high", "products": ["", ""], "avg_price": "", "keywords": ["", ""]}], "recommendations": ["action1", "action2"] }`
  );
}

// ─── AGENT 2: SEO OPTIMIZER ────────────────────────────────────────────────────
export async function seoAgent(listing: {
  title: string;
  description: string;
  tags: string[];
  price: string;
  category: string;
}): Promise<SEOResult> {
  return runAgentJSON(
    `You are an Etsy SEO specialist. You optimize listings to rank on the first page of Etsy search.
Rules:
- Titles must be 140 chars max, front-load main keywords
- Use all 13 tag slots, each tag 1-3 words, no duplicates across title
- Descriptions must be 1500-2000 chars, conversational, keyword-rich
- Price competitively for the niche`,
    `Optimize this Etsy listing for maximum search visibility:
Title: ${listing.title}
Description: ${listing.description}
Tags: ${listing.tags.join(", ")}
Price: ${listing.price}
Category: ${listing.category}

Return JSON: { "optimized_title": "", "optimized_description": "", "optimized_tags": ["tag1",...13 tags], "suggested_price": "", "seo_score": 0-100, "improvements": [""] }`
  );
}

// ─── AGENT 3: PRODUCT CREATOR ─────────────────────────────────────────────────
export async function productCreatorAgent(niche: string, productType: "digital" | "pod"): Promise<ProductIdea[]> {
  return runAgentJSON(
    `You are a product creation agent for an Etsy shop. You create complete, ready-to-publish product listings.
For digital products: focus on templates, planners, guides, printables, SVG bundles.
For POD: focus on t-shirts, mugs, tote bags with niche-specific designs.
Each listing must be fully optimized for Etsy SEO and ready to publish immediately.`,
    `Create 3 complete Etsy listings for the "${niche}" niche, product type: ${productType}.
Return JSON array: [{ "title": "140 char max SEO title", "description": "full listing description 1500+ chars", "tags": ["tag1",...13 tags max], "price": "$X.XX", "category": "category name", "design_brief": "what the product looks like / contains" }]`
  );
}

// ─── AGENT 4: LISTING MANAGER ─────────────────────────────────────────────────
export async function listingManagerAgent(): Promise<ListingAction[]> {
  const { results: listings } = await etsyGet(
    `/application/shops/${SHOP_ID}/listings?state=active&limit=100&includes=stats`
  ).catch(() => ({ results: [] }));

  if (!listings.length) return [];

  const listingSummary = listings.map((l: any) => ({
    id: l.listing_id,
    title: l.title,
    views: l.views || 0,
    num_favorers: l.num_favorers || 0,
    price: l.price?.amount / l.price?.divisor || 0,
    created: l.creation_timestamp,
  }));

  return runAgentJSON(
    `You are a listing management agent. You analyze Etsy store performance and recommend specific actions.
Focus on: refreshing stale listings, identifying underperformers, spotting winners to duplicate.
A listing is stale if it's over 30 days old with under 10 views.
A listing is a winner if it has over 50 views or 5+ favorites.`,
    `Analyze these listings and recommend actions:
${JSON.stringify(listingSummary, null, 2)}
Return JSON array: [{ "listing_id": "", "action": "refresh|duplicate|optimize|archive|boost", "reason": "", "priority": "high|medium|low" }]`
  );
}

// ─── AGENT 5: PRICING AGENT ───────────────────────────────────────────────────
export async function pricingAgent(listingTitle: string, currentPrice: number, category: string): Promise<PricingResult> {
  return runAgentJSON(
    `You are a pricing optimization agent for Etsy. You analyze market prices and recommend optimal pricing.
For digital products: typical range $2.99-$19.99. Sweet spots: $3.99, $4.99, $7.99, $9.99.
For POD products: typical range $19.99-$34.99. Sweet spots: $21.99, $24.99, $27.99.
Higher prices signal quality. Don't race to the bottom.`,
    `Recommend optimal pricing for this Etsy listing:
Title: ${listingTitle}
Current Price: $${currentPrice}
Category: ${category}
Return JSON: { "recommended_price": 0.00, "min_price": 0.00, "max_price": 0.00, "reasoning": "", "confidence": "high|medium|low" }`
  );
}

// ─── AGENT 6: ANALYTICS AGENT ─────────────────────────────────────────────────
export async function analyticsAgent(): Promise<AnalyticsReport> {
  const [listingsRes, shopRes] = await Promise.all([
    etsyGet(`/application/shops/${SHOP_ID}/listings?state=active&limit=100`).catch(() => ({ results: [] })),
    etsyGet(`/application/shops/${SHOP_ID}`).catch(() => ({})),
  ]);

  const listings = listingsRes.results || [];
  const totalViews = listings.reduce((s: number, l: any) => s + (l.views || 0), 0);
  const totalFavorites = listings.reduce((s: number, l: any) => s + (l.num_favorers || 0), 0);

  const report = await runAgent(
    `You are an analytics agent for an Etsy store. You analyze store performance and provide actionable insights.
Be specific and data-driven. Identify what's working and what needs immediate attention.`,
    `Analyze this Etsy store data and provide a performance report:
Total active listings: ${listings.length}
Total views across all listings: ${totalViews}
Total favorites: ${totalFavorites}
Top listings by views: ${JSON.stringify(listings.slice(0, 5).map((l: any) => ({ title: l.title, views: l.views, favorites: l.num_favorers })))}

Provide: overall health score (0-100), top 3 wins, top 3 problems, top 5 immediate actions.`,
    1500
  );

  return {
    timestamp: new Date().toISOString(),
    listings_count: listings.length,
    total_views: totalViews,
    total_favorites: totalFavorites,
    report,
  };
}

// ─── PUBLISH LISTING TO ETSY ──────────────────────────────────────────────────
export async function publishListing(product: ProductIdea): Promise<{ listing_id: string; url: string }> {
  const priceNum = parseFloat(product.price.replace("$", "")) || 4.99;
  const listing = await etsyPost(`/application/shops/${SHOP_ID}/listings`, {
    quantity: 999,
    title: product.title.slice(0, 140),
    description: product.description,
    price: priceNum,
    who_made: "i_did",
    when_made: "made_to_order",
    taxonomy_id: 2078,
    tags: product.tags.slice(0, 13),
    is_digital: true,
    should_auto_renew: true,
    is_taxable: false,
    type: "download",
  });

  return {
    listing_id: listing.listing_id,
    url: `https://www.etsy.com/listing/${listing.listing_id}`,
  };
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
export interface TrendingNiche {
  niche: string;
  demand: string;
  competition: string;
  products: string[];
  avg_price: string;
  keywords: string[];
}

export interface SEOResult {
  optimized_title: string;
  optimized_description: string;
  optimized_tags: string[];
  suggested_price: string;
  seo_score: number;
  improvements: string[];
}

export interface ProductIdea {
  title: string;
  description: string;
  tags: string[];
  price: string;
  category: string;
  design_brief: string;
}

export interface ListingAction {
  listing_id: string;
  action: string;
  reason: string;
  priority: string;
}

export interface PricingResult {
  recommended_price: number;
  min_price: number;
  max_price: number;
  reasoning: string;
  confidence: string;
}

export interface AnalyticsReport {
  timestamp: string;
  listings_count: number;
  total_views: number;
  total_favorites: number;
  report: string;
}