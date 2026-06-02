export type AgentId = "orchestrator" | "researcher" | "creator" | "listing" | "customer" | "analytics";

export interface AgentMeta {
  name: string;
  icon: string;
  color: string;
  short: string;
}

export const AGENT_META: Record<AgentId, AgentMeta> = {
  orchestrator: { name: "Orchestrator", icon: "🧠", color: "#FB5607", short: "ORCH" },
  researcher:   { name: "Market Researcher", icon: "🔍", color: "#F4A261", short: "RSRCH" },
  creator:      { name: "Product Creator", icon: "🎨", color: "#E76F51", short: "CREAT" },
  listing:      { name: "Listing Manager", icon: "📋", color: "#2A9D8F", short: "LIST" },
  customer:     { name: "Customer Service", icon: "💬", color: "#457B9D", short: "CX" },
  analytics:    { name: "Analytics Agent", icon: "📊", color: "#8338EC", short: "ANLYT" },
};

export interface StoreInfo {
  name: string;
  niche: string;
  rating: number;
  totalSales: number;
}

export interface Listing {
  id: string;
  title: string;
  price: string;
  status: "active" | "draft";
  views: number;
  sales: number;
}

export interface Message {
  from: string;
  issue: string;
  orderId: string;
}

export interface SalesData {
  thisMonth: number;
  lastMonth: number;
  orders: number;
  avgOrderValue: number;
}

export interface StoreState {
  storeInfo: StoreInfo;
  listings: Listing[];
  messages: Message[];
  salesData: SalesData;
}

export interface Run {
  id: number;
  agentId: AgentId;
  task: string;
  status: "running" | "done" | "error";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  error: string | null;
  time: string;
}

export interface LogEntry {
  id: number;
  agentId: AgentId;
  msg: string;
  type: "info" | "error";
  time: string;
}

// Agent result types
export interface OrchestratorTask {
  agent: AgentId;
  task: string;
  priority: "high" | "medium" | "low";
}

export interface OrchestratorResult {
  strategy: string;
  tasks: OrchestratorTask[];
  reasoning: string;
}

export interface ProductOpportunity {
  product: string;
  reason: string;
  estimated_price: string;
  competition: "low" | "medium" | "high";
  demand: "low" | "medium" | "high";
}

export interface ResearchResult {
  trending_keywords: string[];
  product_opportunities: ProductOpportunity[];
  competitor_insights: string;
  recommended_focus: string;
}

export interface CreatorResult {
  title: string;
  description: string;
  tags: string[];
  price: string;
  category: string;
  files_included: string[];
  mockup_prompt: string;
}

export interface ListingResult {
  seo_score: number;
  optimizations: string[];
  price_recommendation: string;
  title_variant: string;
  top_tags_to_add: string[];
  listing_status: "ready" | "needs_work";
  predicted_monthly_sales: string;
}

export interface CxResponse {
  to: string;
  subject: string;
  message: string;
  action: "resolve" | "escalate" | "refund" | "follow_up";
}

export interface CxResult {
  responses: CxResponse[];
  review_requests: string[];
  flagged_issues: string[];
  satisfaction_score: number;
}

export interface TopPerformer {
  product: string;
  units: number;
  revenue: string;
}

export interface Underperformer {
  product: string;
  issue: string;
  action: string;
}

export interface AnalyticsResult {
  revenue_this_month: string;
  revenue_trend: string;
  top_performers: TopPerformer[];
  underperformers: Underperformer[];
  conversion_rate: string;
  key_insights: string[];
  next_actions: string[];
}

export const INITIAL_STATE: StoreState = {
  storeInfo: { name: "", niche: "", rating: 0, totalSales: 0 },
  listings: [],
  messages: [],
  salesData: { thisMonth: 0, lastMonth: 0, orders: 0, avgOrderValue: 0 },
};
