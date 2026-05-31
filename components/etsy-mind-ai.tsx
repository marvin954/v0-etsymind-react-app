"use client";

import { useState, useCallback, useRef } from "react";
import { Badge, AgentAvatar, ThinkingDots, JsonViewer, RunCard } from "@/components/etsy-ui";
import { Agents } from "@/lib/etsy-agents";
import {
  AgentId,
  AGENT_META,
  INITIAL_STATE,
  StoreState,
  Run,
  LogEntry,
  OrchestratorResult,
  ResearchResult,
  CreatorResult,
  ListingResult,
  AnalyticsResult,
  CxResult,
} from "@/lib/etsy-types";

type TabId = "command" | "agents" | "store" | "results" | "log";

export default function EtsyMindAI() {
  const [tab, setTab] = useState<TabId>("command");
  const [storeState, setStoreState] = useState<StoreState>(INITIAL_STATE);
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [systemLog, setSystemLog] = useState<LogEntry[]>([]);
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null);
  const [creatorResult, setCreatorResult] = useState<CreatorResult | null>(null);
  const [listingResult, setListingResult] = useState<ListingResult | null>(null);
  const [analyticsResult, setAnalyticsResult] = useState<AnalyticsResult | null>(null);
  const [cxResult, setCxResult] = useState<CxResult | null>(null);
  const [orchestratorResult, setOrchestratorResult] = useState<OrchestratorResult | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const log = useCallback((agentId: AgentId, msg: string, type: "info" | "error" = "info") => {
    setSystemLog((prev) => [
      {
        id: Date.now() + Math.random(),
        agentId,
        msg,
        type,
        time: new Date().toLocaleTimeString(),
      },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const addRun = useCallback((agentId: AgentId, task: string) => {
    const id = Date.now() + Math.random();
    setRuns((prev) => [
      {
        id,
        agentId,
        task,
        status: "running",
        result: null,
        error: null,
        time: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
    return id;
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finishRun = useCallback((id: number, result: any) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "done", result } : r)));
  }, []);

  const errorRun = useCallback((id: number, error: string) => {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, status: "error", error } : r)));
  }, []);

  // Full pipeline
  const runPipeline = async () => {
    if (!goal.trim() || isRunning) return;
    setIsRunning(true);
    setExpandedRun(null);

    // 1. ORCHESTRATOR
    log("orchestrator", `Planning strategy for: "${goal}"`);
    const orchId = addRun("orchestrator", `Strategize: "${goal}"`);
    let orchPlan: OrchestratorResult;
    try {
      orchPlan = await Agents.orchestrator(storeState, goal);
      setOrchestratorResult(orchPlan);
      finishRun(orchId, orchPlan);
      log("orchestrator", `Strategy ready — ${orchPlan.tasks?.length || 0} tasks dispatched`);
      setExpandedRun(orchId);
    } catch (e) {
      errorRun(orchId, e instanceof Error ? e.message : "Unknown error");
      log("orchestrator", "Strategy failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      setIsRunning(false);
      return;
    }

    // 2. MARKET RESEARCHER
    await new Promise((r) => setTimeout(r, 600));
    log("researcher", "Scanning Etsy market trends...");
    const resId = addRun("researcher", `Research niche: ${storeState.storeInfo.niche}`);
    let resData: ResearchResult | undefined;
    try {
      resData = await Agents.researcher(storeState.storeInfo.niche, storeState.listings.map((l) => l.title));
      setResearchResult(resData);
      finishRun(resId, resData);
      log("researcher", `Found ${resData.product_opportunities?.length || 0} opportunities, ${resData.trending_keywords?.length || 0} keywords`);
    } catch (e) {
      errorRun(resId, e instanceof Error ? e.message : "Unknown error");
      log("researcher", "Research failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    }

    // 3. PRODUCT CREATOR
    await new Promise((r) => setTimeout(r, 500));
    const productIdea = resData?.product_opportunities?.[0]?.product || "Digital Printable Planner";
    const keywords = resData?.trending_keywords || ["printable", "digital download", "planner"];
    log("creator", `Creating: "${productIdea}"...`);
    const creatId = addRun("creator", `Create product: "${productIdea}"`);
    let createdProduct: CreatorResult | undefined;
    try {
      createdProduct = await Agents.creator(productIdea, keywords);
      setCreatorResult(createdProduct);
      finishRun(creatId, createdProduct);
      log("creator", `Listing ready: "${createdProduct.title?.slice(0, 50)}..."`);
    } catch (e) {
      errorRun(creatId, e instanceof Error ? e.message : "Unknown error");
      log("creator", "Product creation failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    }

    // 4. LISTING MANAGER
    await new Promise((r) => setTimeout(r, 500));
    log("listing", "Optimizing and publishing listing...");
    const listId = addRun("listing", `Optimize & publish: "${createdProduct?.title?.slice(0, 40) || productIdea}"`);
    try {
      const listData = await Agents.listing(createdProduct || storeState.listings[0], storeState.salesData);
      setListingResult(listData);
      finishRun(listId, listData);
      if (createdProduct) {
        setStoreState((prev) => ({
          ...prev,
          listings: [
            ...prev.listings,
            {
              id: "L" + (prev.listings.length + 1).toString().padStart(3, "0"),
              title: createdProduct.title?.slice(0, 60) || productIdea,
              price: createdProduct.price || "$5.99",
              status: listData?.listing_status === "ready" ? "active" : "draft",
              views: 0,
              sales: 0,
            },
          ],
        }));
      }
      log("listing", `SEO score: ${listData?.seo_score}/100 — ${listData?.listing_status}`);
    } catch (e) {
      errorRun(listId, e instanceof Error ? e.message : "Unknown error");
      log("listing", "Listing failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    }

    // 5. CUSTOMER SERVICE
    await new Promise((r) => setTimeout(r, 500));
    log("customer", `Handling ${storeState.messages.length} customer messages...`);
    const cxId = addRun("customer", `Handle ${storeState.messages.length} messages`);
    try {
      const cxData = await Agents.customer(storeState.messages, storeState.salesData);
      setCxResult(cxData);
      finishRun(cxId, cxData);
      log("customer", `${cxData.responses?.length || 0} responses drafted, satisfaction: ${cxData.satisfaction_score}/10`);
    } catch (e) {
      errorRun(cxId, e instanceof Error ? e.message : "Unknown error");
      log("customer", "CX failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    }

    // 6. ANALYTICS
    await new Promise((r) => setTimeout(r, 500));
    log("analytics", "Running sales analysis...");
    const anlId = addRun("analytics", "Full store analytics report");
    try {
      const anlData = await Agents.analytics(storeState.salesData, storeState.listings);
      setAnalyticsResult(anlData);
      finishRun(anlId, anlData);
      log("analytics", `Revenue: ${anlData.revenue_this_month} (${anlData.revenue_trend}) | CVR: ${anlData.conversion_rate}`);
    } catch (e) {
      errorRun(anlId, e instanceof Error ? e.message : "Unknown error");
      log("analytics", "Analytics failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    }

    log("orchestrator", "Full pipeline complete. Store updated.");
    setIsRunning(false);
  };

  // Single agent runner
  const runAgent = async (agentId: AgentId) => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      switch (agentId) {
        case "researcher": {
          const id = addRun("researcher", `Research: ${storeState.storeInfo.niche}`);
          log("researcher", "Running market research...");
          try {
            const r = await Agents.researcher(storeState.storeInfo.niche, storeState.listings.map((l) => l.title));
            setResearchResult(r);
            finishRun(id, r);
            setExpandedRun(id);
            log("researcher", "Research complete");
          } catch (e) {
            errorRun(id, e instanceof Error ? e.message : "Unknown error");
            log("researcher", e instanceof Error ? e.message : "Unknown error", "error");
          }
          break;
        }
        case "creator": {
          const idea = researchResult?.product_opportunities?.[0]?.product || "Minimalist Digital Planner";
          const keys = researchResult?.trending_keywords || ["planner", "printable", "digital"];
          const id = addRun("creator", `Create: "${idea}"`);
          log("creator", "Generating product...");
          try {
            const r = await Agents.creator(idea, keys);
            setCreatorResult(r);
            finishRun(id, r);
            setExpandedRun(id);
            log("creator", "Product created");
          } catch (e) {
            errorRun(id, e instanceof Error ? e.message : "Unknown error");
            log("creator", e instanceof Error ? e.message : "Unknown error", "error");
          }
          break;
        }
        case "listing": {
          const product = creatorResult || storeState.listings[0];
          const id = addRun("listing", "Optimize listings");
          log("listing", "Optimizing...");
          try {
            const r = await Agents.listing(product, storeState.salesData);
            setListingResult(r);
            finishRun(id, r);
            setExpandedRun(id);
            log("listing", "Listing optimized");
          } catch (e) {
            errorRun(id, e instanceof Error ? e.message : "Unknown error");
            log("listing", e instanceof Error ? e.message : "Unknown error", "error");
          }
          break;
        }
        case "customer": {
          const id = addRun("customer", `Handle ${storeState.messages.length} messages`);
          log("customer", "Processing messages...");
          try {
            const r = await Agents.customer(storeState.messages, storeState.salesData);
            setCxResult(r);
            finishRun(id, r);
            setExpandedRun(id);
            log("customer", "Messages handled");
          } catch (e) {
            errorRun(id, e instanceof Error ? e.message : "Unknown error");
            log("customer", e instanceof Error ? e.message : "Unknown error", "error");
          }
          break;
        }
        case "analytics": {
          const id = addRun("analytics", "Analytics report");
          log("analytics", "Analyzing...");
          try {
            const r = await Agents.analytics(storeState.salesData, storeState.listings);
            setAnalyticsResult(r);
            finishRun(id, r);
            setExpandedRun(id);
            log("analytics", "Report ready");
          } catch (e) {
            errorRun(id, e instanceof Error ? e.message : "Unknown error");
            log("analytics", e instanceof Error ? e.message : "Unknown error", "error");
          }
          break;
        }
      }
    } finally {
      setIsRunning(false);
    }
  };

  const activeCount = runs.filter((r) => r.status === "running").length;

  const suggestedGoals = [
    "Find trending niches and create new products",
    "Optimize all listings for better SEO",
    "Handle all customer messages and request reviews",
    "Run full store analytics and report insights",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-6">
        <div className="flex items-center gap-4">
          <span className="bg-gradient-to-r from-accent via-agent-creator to-primary bg-clip-text font-heading text-lg font-extrabold text-transparent">
            EtsyMind AI
          </span>
          <div className="h-5 w-px bg-border" />
          <span className="text-xs text-muted-foreground">{storeState.storeInfo.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              <span className="text-xs text-primary">
                {activeCount} agent{activeCount > 1 ? "s" : ""} running
              </span>
            </div>
          )}
          <nav className="flex gap-0.5 rounded-lg bg-secondary p-1">
            {(["command", "agents", "store", "results", "log"] as TabId[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded-md px-3.5 py-1 text-xs capitalize transition-all ${
                  tab === t
                    ? "bg-muted font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl p-6">
        {/* Command Center Tab */}
        {tab === "command" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-5">
                <h1 className="mb-1 font-heading text-2xl font-extrabold">Command Center</h1>
                <p className="text-sm text-muted-foreground">
                  Direct the entire agent system with a natural language goal
                </p>
              </div>

              {/* Goal Input */}
              <div className="mb-4 rounded-2xl border border-border bg-card p-5">
                <div className="mb-2.5 text-xs uppercase tracking-widest text-muted-foreground">
                  🧠 Your Goal
                </div>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder='e.g. "Find trending products and create 3 new listings for the holiday season" or "Optimize all listings and handle customer messages"'
                  className="min-h-[90px] w-full resize-y rounded-lg border border-border bg-secondary px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {suggestedGoals.map((s) => (
                    <button
                      key={s}
                      onClick={() => setGoal(s)}
                      className="cursor-pointer rounded-full border border-muted bg-muted px-3 py-1 text-[11px] text-secondary-foreground transition-colors hover:bg-border"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Pipeline Button */}
              <button
                onClick={runPipeline}
                disabled={isRunning || !goal.trim()}
                className={`mb-5 w-full rounded-xl px-4 py-4 font-heading text-[15px] font-bold tracking-wide transition-all ${
                  isRunning || !goal.trim()
                    ? "cursor-not-allowed bg-muted text-muted-foreground"
                    : "cursor-pointer bg-gradient-to-r from-accent via-agent-creator to-primary text-white shadow-[0_4px_20px_#F4A26144] hover:opacity-90"
                }`}
              >
                {isRunning ? "🔄  Agents Running..." : "🚀  Run Full Pipeline (All 6 Agents)"}
              </button>

              {/* Recent Runs */}
              {runs.length > 0 && (
                <div>
                  <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                    Recent Runs
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {runs.slice(0, 8).map((run) => (
                      <RunCard
                        key={run.id}
                        run={run}
                        expanded={expandedRun === run.id}
                        onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-3.5">
              {/* Store Health */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3.5 text-xs uppercase tracking-widest text-muted-foreground">
                  Store Health
                </div>
                {[
                  { label: "Monthly Revenue", value: `$${storeState.salesData.thisMonth.toLocaleString()}`, color: "#4ade80" },
                  { label: "Total Orders", value: storeState.salesData.orders, color: "#60a5fa" },
                  { label: "Active Listings", value: storeState.listings.filter((l) => l.status === "active").length, color: "#F4A261" },
                  { label: "Store Rating", value: `${storeState.storeInfo.rating} ★`, color: "#fbbf24" },
                  { label: "Total Sales", value: storeState.storeInfo.totalSales, color: "#a78bfa" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between border-b border-secondary py-2 last:border-0">
                    <span className="text-xs text-secondary-foreground">{m.label}</span>
                    <span className="font-heading text-[13px] font-bold" style={{ color: m.color }}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Live Log Preview */}
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
                  Live Activity
                </div>
                {systemLog.length === 0 ? (
                  <div className="py-5 text-center text-xs text-muted-foreground/50">No activity yet</div>
                ) : (
                  <div className="flex max-h-[260px] flex-col gap-2 overflow-y-auto">
                    {systemLog.slice(0, 10).map((entry) => {
                      const m = AGENT_META[entry.agentId];
                      return (
                        <div key={entry.id} className="flex animate-[fadeIn_0.2s_ease] items-start gap-2">
                          <span className="shrink-0 text-sm">{m.icon}</span>
                          <div className="min-w-0 flex-1">
                            <span className={`block text-[11px] leading-snug ${entry.type === "error" ? "text-destructive" : "text-secondary-foreground"}`}>
                              {entry.msg}
                            </span>
                            <span className="text-[10px] text-muted-foreground/50">{entry.time}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {tab === "agents" && (
          <div>
            <h1 className="mb-1 font-heading text-2xl font-extrabold">Agent Network</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Run individual agents or let the Orchestrator coordinate them all
            </p>

            {/* Orchestrator */}
            <div
              className="mb-4 rounded-2xl border p-5"
              style={{
                background: "#0e0e0e",
                borderColor: "#FB560733",
                borderLeftWidth: 4,
                borderLeftColor: "#FB5607",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <AgentAvatar agentId="orchestrator" size={48} />
                  <div>
                    <div className="font-heading text-[17px] font-bold text-primary">🧠 Orchestrator</div>
                    <div className="mt-0.5 text-[13px] text-secondary-foreground">
                      Coordinates all agents · Sets priorities · Synthesizes strategy
                    </div>
                    <div className="mt-1.5 flex gap-1.5">
                      <Badge color="#FB5607">Coordinator</Badge>
                      <Badge color="#888">Always runs first</Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={runPipeline}
                  disabled={isRunning || !goal.trim()}
                  className={`rounded-lg px-5 py-2.5 text-[13px] font-semibold ${
                    isRunning
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "cursor-pointer bg-gradient-to-r from-accent to-primary text-white"
                  }`}
                >
                  {isRunning ? "Running..." : "Run Pipeline"}
                </button>
              </div>
              {orchestratorResult && (
                <div className="mt-4">
                  <div className="mb-2 text-xs text-primary">Last Strategy:</div>
                  <div className="rounded-lg bg-[#0a0a0a] p-3 text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">Strategy:</strong> {orchestratorResult.strategy}
                    <br />
                    <strong className="text-foreground">Reasoning:</strong> {orchestratorResult.reasoning}
                  </div>
                  {orchestratorResult.tasks && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {orchestratorResult.tasks.map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs">{AGENT_META[t.agent]?.icon || "•"}</span>
                          <span className="text-xs text-secondary-foreground">{t.task}</span>
                          <Badge color={t.priority === "high" ? "#f87171" : t.priority === "medium" ? "#fbbf24" : "#888"}>
                            {t.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Individual Agents */}
            <div className="grid gap-3.5 md:grid-cols-2">
              {[
                { id: "researcher" as AgentId, desc: "Scans Etsy trends, competitor pricing, keyword opportunities, and profitable niches", btnLabel: "Run Research" },
                { id: "creator" as AgentId, desc: "Generates product ideas, SEO titles, descriptions, tags, pricing, and file lists", btnLabel: "Create Product" },
                { id: "listing" as AgentId, desc: "Optimizes listing SEO, A/B tests titles, adjusts pricing, manages renewals", btnLabel: "Optimize Listings" },
                { id: "customer" as AgentId, desc: "Drafts message responses, requests reviews, handles refunds, tracks satisfaction", btnLabel: "Handle Messages" },
                { id: "analytics" as AgentId, desc: "Tracks revenue, conversion rates, identifies top performers and underperformers", btnLabel: "Run Analytics" },
              ].map(({ id, desc, btnLabel }) => {
                const m = AGENT_META[id];
                const resultMap: Record<AgentId, ResearchResult | CreatorResult | ListingResult | CxResult | AnalyticsResult | null> = {
                  researcher: researchResult,
                  creator: creatorResult,
                  listing: listingResult,
                  customer: cxResult,
                  analytics: analyticsResult,
                  orchestrator: null,
                };
                const result = resultMap[id];
                return (
                  <div
                    key={id}
                    className="rounded-xl p-4"
                    style={{
                      background: "#0e0e0e",
                      border: `1px solid ${m.color}22`,
                      borderLeftWidth: 3,
                      borderLeftColor: m.color,
                    }}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <AgentAvatar agentId={id} size={40} />
                        <div>
                          <div className="font-heading text-sm font-bold" style={{ color: m.color }}>
                            {m.name}
                          </div>
                          {result && <Badge color="#4ade80">Has results</Badge>}
                        </div>
                      </div>
                      <button
                        onClick={() => runAgent(id)}
                        disabled={isRunning}
                        className="whitespace-nowrap rounded-lg px-3 py-1.5 text-[11px] font-semibold"
                        style={{
                          background: `${m.color}22`,
                          border: `1px solid ${m.color}44`,
                          color: m.color,
                          cursor: isRunning ? "not-allowed" : "pointer",
                        }}
                      >
                        {btnLabel}
                      </button>
                    </div>
                    <div className={`text-xs leading-relaxed text-secondary-foreground ${result ? "mb-3" : ""}`}>
                      {desc}
                    </div>
                    {result && <JsonViewer data={result} color={m.color} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Store Tab */}
        {tab === "store" && (
          <div>
            <h1 className="mb-1 font-heading text-2xl font-extrabold">Store Manager</h1>
            <p className="mb-6 text-sm text-muted-foreground">Current listings, messages, and store state</p>

            <div className="grid gap-5 md:grid-cols-2">
              {/* Listings */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 font-heading text-[15px] font-bold text-agent-listing">
                  📋 Active Listings ({storeState.listings.length})
                </div>
                <div className="flex flex-col gap-2.5">
                  {storeState.listings.map((l) => (
                    <div key={l.id} className="rounded-lg bg-secondary p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">{l.title.slice(0, 45)}...</span>
                        <span className="font-heading text-xs font-bold text-accent">{l.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge color={l.status === "active" ? "#4ade80" : "#fbbf24"}>{l.status}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {l.views} views · {l.sales} sales
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 font-heading text-[15px] font-bold text-agent-customer">
                  💬 Customer Messages ({storeState.messages.length})
                </div>
                <div className="flex flex-col gap-2.5">
                  {storeState.messages.map((msg, i) => (
                    <div key={i} className="rounded-lg bg-secondary p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[13px] font-semibold">{msg.from}</span>
                        <span className="text-[11px] text-muted-foreground">{msg.orderId}</span>
                      </div>
                      <div className="text-xs text-secondary-foreground">{msg.issue}</div>
                    </div>
                  ))}
                  {cxResult?.responses && cxResult.responses.length > 0 && (
                    <div className="mt-2">
                      <div className="mb-2 text-[11px] text-agent-customer">AI Drafted Responses:</div>
                      {cxResult.responses.map((r, i) => (
                        <div key={i} className="mb-1.5 rounded-lg border border-agent-customer/20 bg-[#0a1520] p-2.5">
                          <div className="mb-1 text-[11px] text-agent-customer">
                            To: {r.to} — {r.subject}
                          </div>
                          <div className="text-[11px] leading-relaxed text-muted-foreground">{r.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {tab === "results" && (
          <div>
            <h1 className="mb-1 font-heading text-2xl font-extrabold">Agent Results</h1>
            <p className="mb-6 text-sm text-muted-foreground">Outputs from all agent runs</p>

            <div className="flex flex-col gap-5">
              {[
                { id: "researcher" as AgentId, data: researchResult, label: "Market Research" },
                { id: "creator" as AgentId, data: creatorResult, label: "Created Product" },
                { id: "listing" as AgentId, data: listingResult, label: "Listing Optimization" },
                { id: "analytics" as AgentId, data: analyticsResult, label: "Analytics Report" },
                { id: "customer" as AgentId, data: cxResult, label: "Customer Service" },
              ]
                .filter((r) => r.data)
                .map(({ id, data, label }) => {
                  const m = AGENT_META[id];
                  return (
                    <div
                      key={id}
                      className="animate-[fadeIn_0.3s_ease] rounded-2xl p-5"
                      style={{ background: "#0e0e0e", border: `1px solid ${m.color}33` }}
                    >
                      <div className="mb-4 flex items-center gap-3">
                        <AgentAvatar agentId={id} size={40} />
                        <div>
                          <div className="font-heading text-[15px] font-bold" style={{ color: m.color }}>
                            {m.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                        <Badge color="#4ade80" className="ml-auto">
                          Complete
                        </Badge>
                      </div>

                      {/* Researcher */}
                      {id === "researcher" && data && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="mb-2 text-[11px] uppercase tracking-wider text-accent">Trending Keywords</div>
                            <div className="flex flex-wrap gap-1.5">
                              {(data as ResearchResult).trending_keywords?.map((k) => (
                                <Badge key={k} color="#F4A261">{k}</Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="mb-2 text-[11px] uppercase tracking-wider text-accent">Top Opportunity</div>
                            {(data as ResearchResult).product_opportunities?.[0] && (
                              <div className="rounded-lg bg-secondary p-2.5 text-xs leading-relaxed">
                                <strong className="text-foreground">
                                  {(data as ResearchResult).product_opportunities[0].product}
                                </strong>
                                <br />
                                <span className="text-secondary-foreground">
                                  {(data as ResearchResult).product_opportunities[0].reason}
                                </span>
                                <br />
                                <span className="text-success">
                                  {(data as ResearchResult).product_opportunities[0].estimated_price}
                                </span>
                                {" · "}
                                <Badge
                                  color={
                                    (data as ResearchResult).product_opportunities[0].competition === "low"
                                      ? "#4ade80"
                                      : "#fbbf24"
                                  }
                                >
                                  {(data as ResearchResult).product_opportunities[0].competition} competition
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="rounded-lg bg-secondary p-2.5 text-xs leading-relaxed text-secondary-foreground md:col-span-2">
                            <strong className="text-foreground">Recommendation:</strong>{" "}
                            {(data as ResearchResult).recommended_focus}
                          </div>
                        </div>
                      )}

                      {/* Creator */}
                      {id === "creator" && data && (
                        <div className="flex flex-col gap-2.5">
                          <div className="rounded-lg bg-secondary p-3">
                            <div className="mb-1 text-[11px] text-agent-creator">Title</div>
                            <div className="text-[13px] leading-relaxed text-foreground">
                              {(data as CreatorResult).title}
                            </div>
                          </div>
                          <div className="rounded-lg bg-secondary p-3">
                            <div className="mb-1 text-[11px] text-agent-creator">Description</div>
                            <div className="text-xs leading-relaxed text-muted-foreground">
                              {(data as CreatorResult).description}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(data as CreatorResult).tags?.map((t) => (
                              <Badge key={t} color="#E76F51">{t}</Badge>
                            ))}
                          </div>
                          <div className="flex gap-2.5">
                            <Badge color="#4ade80">Price: {(data as CreatorResult).price}</Badge>
                            <Badge color="#60a5fa">{(data as CreatorResult).category}</Badge>
                          </div>
                        </div>
                      )}

                      {/* Listing */}
                      {id === "listing" && data && (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="font-heading text-[28px] font-bold"
                              style={{ color: (data as ListingResult).seo_score > 80 ? "#4ade80" : "#fbbf24" }}
                            >
                              {(data as ListingResult).seo_score}
                            </div>
                            <div className="text-xs text-muted-foreground">SEO Score / 100</div>
                            <Badge color={(data as ListingResult).listing_status === "ready" ? "#4ade80" : "#fbbf24"}>
                              {(data as ListingResult).listing_status}
                            </Badge>
                            <Badge color="#60a5fa">~{(data as ListingResult).predicted_monthly_sales} sales/mo</Badge>
                          </div>
                          <div>
                            <div className="mb-1.5 text-[11px] text-agent-listing">Optimizations:</div>
                            {(data as ListingResult).optimizations?.map((o, i) => (
                              <div key={i} className="border-b border-secondary py-1 text-xs text-muted-foreground last:border-0">
                                • {o}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Analytics */}
                      {id === "analytics" && data && (
                        <div className="grid gap-2.5 md:grid-cols-3">
                          {[
                            { label: "Revenue", value: (data as AnalyticsResult).revenue_this_month, color: "#4ade80" },
                            { label: "Trend", value: (data as AnalyticsResult).revenue_trend, color: "#60a5fa" },
                            { label: "CVR", value: (data as AnalyticsResult).conversion_rate, color: "#a78bfa" },
                          ].map((metric) => (
                            <div key={metric.label} className="rounded-lg bg-secondary p-3 text-center">
                              <div className="font-heading text-xl font-bold" style={{ color: metric.color }}>
                                {metric.value}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{metric.label}</div>
                            </div>
                          ))}
                          <div className="md:col-span-3">
                            {(data as AnalyticsResult).key_insights?.map((ins, i) => (
                              <div key={i} className="border-b border-secondary py-1.5 text-xs text-muted-foreground last:border-0">
                                💡 {ins}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Customer */}
                      {id === "customer" && data && (
                        <div>
                          <div className="mb-3 flex gap-2.5">
                            <Badge color="#457B9D">{(data as CxResult).responses?.length || 0} responses</Badge>
                            <Badge color="#4ade80">Satisfaction: {(data as CxResult).satisfaction_score}/10</Badge>
                          </div>
                          {(data as CxResult).responses?.map((r, i) => (
                            <div key={i} className="mb-2 rounded-lg bg-secondary p-3">
                              <div className="mb-1 text-[11px] text-agent-customer">
                                To: {r.to} | {r.subject}
                              </div>
                              <div className="text-xs leading-relaxed text-muted-foreground">{r.message}</div>
                              <div className="mt-1.5">
                                <Badge color="#888">{r.action}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <JsonViewer data={data} color={m.color} />
                    </div>
                  );
                })}

              {!researchResult && !creatorResult && !listingResult && !analyticsResult && !cxResult && (
                <div className="py-16 text-center text-muted-foreground/50">
                  <div className="mb-3 text-5xl">🤖</div>
                  <div className="mb-1.5 font-heading text-lg font-bold text-muted-foreground">No results yet</div>
                  <div className="text-sm">Run the full pipeline or individual agents to see results here</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Log Tab */}
        {tab === "log" && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h1 className="mb-1 font-heading text-2xl font-extrabold">System Log</h1>
                <p className="text-sm text-muted-foreground">Real-time agent activity and events</p>
              </div>
              <button
                onClick={() => setSystemLog([])}
                className="cursor-pointer rounded-lg border border-muted bg-muted px-3.5 py-1.5 text-xs text-secondary-foreground hover:bg-border"
              >
                Clear Log
              </button>
            </div>
            <div
              ref={feedRef}
              className="max-h-[70vh] overflow-y-auto rounded-2xl border border-sidebar-border bg-[#0a0a0a] p-4 font-mono text-xs"
            >
              {systemLog.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground/50">$ waiting for agent activity...</div>
              ) : (
                systemLog.map((entry) => {
                  const m = AGENT_META[entry.agentId];
                  return (
                    <div
                      key={entry.id}
                      className="flex animate-[fadeIn_0.2s_ease] gap-3 border-b border-secondary py-1.5 last:border-0"
                    >
                      <span className="shrink-0 text-muted-foreground/50">{entry.time}</span>
                      <span className="w-14 shrink-0" style={{ color: m.color }}>
                        [{m.short}]
                      </span>
                      <span className={entry.type === "error" ? "text-destructive" : "text-secondary-foreground"}>
                        {entry.msg}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
