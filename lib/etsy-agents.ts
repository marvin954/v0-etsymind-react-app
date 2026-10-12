import { 
  StoreState, 
  OrchestratorResult, 
  ResearchResult, 
  CreatorResult, 
  ListingResult, 
  CxResult, 
  AnalyticsResult,
  Listing,
  Message,
  SalesData
} from "./etsy-types";

async function callClaude<T>(
  systemPrompt: string, 
  userPrompt: string, 
  jsonMode = false
): Promise<T> {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt, jsonMode }),
  });

  const data = await response.json();
  
  if (!response.ok || data.error) {
    throw new Error(data.error || "API request failed");
  }
  
  return data.result;
}

export const Agents = {
  async orchestrator(storeState: StoreState, userGoal: string): Promise<OrchestratorResult> {
    return callClaude<OrchestratorResult>(
      `You are the Orchestrator AI for an autonomous Etsy store. You coordinate 5 specialist agents: Market Researcher, Product Creator, Listing Manager, Customer Service, Analytics Agent. 
You receive the current store state and a goal, then output a JSON action plan.`,
      `Store state: ${JSON.stringify(storeState, null, 2)}
User goal: "${userGoal}"

Output JSON:
{
  "strategy": "brief overall strategy",
  "tasks": [
    { "agent": "researcher|creator|listing|customer|analytics", "task": "specific task description", "priority": "high|medium|low" }
  ],
  "reasoning": "why this plan"
}`,
      true
    );
  },

  async researcher(niche: string, existingProducts: string[]): Promise<ResearchResult> {
    return callClaude<ResearchResult>(
      `You are a Market Research AI agent for an Etsy store. You analyze market trends, competition, and product opportunities. Output actionable JSON insights.`,
      `Research niche: "${niche}"
Existing products: ${JSON.stringify(existingProducts)}

Output JSON:
{
  "trending_keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "product_opportunities": [
    { "product": "product name", "reason": "why it sells", "estimated_price": "$X-$Y", "competition": "low|medium|high", "demand": "low|medium|high" }
  ],
  "competitor_insights": "brief competitor landscape",
  "recommended_focus": "what to create next and why"
}`,
      true
    );
  },

  async creator(productIdea: string, targetKeywords: string[]): Promise<CreatorResult> {
    return callClaude<CreatorResult>(
      `You are a Product Creator AI for an Etsy digital products store. You create complete product listings with compelling copy, SEO-optimized titles, and strategic tags. Output ready-to-publish JSON.`,
      `Product idea: "${productIdea}"
Target keywords: ${JSON.stringify(targetKeywords)}

Output JSON:
{
  "title": "SEO-optimized Etsy listing title (max 140 chars)",
  "description": "compelling 3-paragraph product description",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13"],
  "price": "suggested price in USD",
  "category": "Etsy category",
  "files_included": ["file1.pdf", "file2.pdf"],
  "mockup_prompt": "detailed image prompt for product mockup"
}`,
      true
    );
  },

  async listing(product: CreatorResult | Listing, storeMetrics: SalesData): Promise<ListingResult> {
    return callClaude<ListingResult>(
      `You are a Listing Manager AI for an Etsy store. You optimize listings for maximum visibility and conversion. Analyze and suggest improvements.`,
      `Product listing: ${JSON.stringify(product)}
Store metrics: ${JSON.stringify(storeMetrics)}

Output JSON:
{
  "seo_score": 85,
  "optimizations": ["specific improvement 1", "specific improvement 2", "specific improvement 3"],
  "price_recommendation": "$X.XX",
  "title_variant": "alternative title to A/B test",
  "top_tags_to_add": ["tag1","tag2"],
  "listing_status": "ready|needs_work",
  "predicted_monthly_sales": "X-Y units"
}`,
      true
    );
  },

  async customer(messages: Message[], orderHistory: SalesData): Promise<CxResult> {
    return callClaude<CxResult>(
      `You are a Customer Service AI for an Etsy digital products store. You handle customer inquiries with warmth and efficiency. Draft professional responses and flag issues.`,
      `Customer messages: ${JSON.stringify(messages)}
Order history context: ${JSON.stringify(orderHistory)}

Output JSON:
{
  "responses": [
    { "to": "customer name", "subject": "Re: their issue", "message": "professional friendly response", "action": "resolve|escalate|refund|follow_up" }
  ],
  "review_requests": ["order IDs to request reviews from"],
  "flagged_issues": ["any patterns or problems to note"],
  "satisfaction_score": 9.2
}`,
      true
    );
  },

  async analytics(salesData: SalesData, listings: Listing[]): Promise<AnalyticsResult> {
    return callClaude<AnalyticsResult>(
      `You are an Analytics AI for an Etsy store. You analyze sales performance, identify trends, and provide data-driven recommendations.`,
      `Sales data: ${JSON.stringify(salesData)}
Listings: ${JSON.stringify(listings)}

Output JSON:
{
  "revenue_this_month": "$X,XXX",
  "revenue_trend": "+X%",
  "top_performers": [{ "product": "name", "units": X, "revenue": "$XXX" }],
  "underperformers": [{ "product": "name", "issue": "why underperforming", "action": "recommended fix" }],
  "conversion_rate": "X.X%",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "next_actions": ["action 1", "action 2"]
}`,
      true
    );
  },
};
