"use client";

import { useState, useRef, useCallback } from "react";

// ── All agent calls hit /api/agent — key lives server-side ──
async function callAgent(systemPrompt: string, userPrompt: string, jsonMode = false) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt, jsonMode }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

const AGENT_META: Record<string, { name: string; icon: string; color: string; short: string }> = {
  orchestrator: { name: "Orchestrator",      icon: "🧠", color: "#FB5607", short: "ORCH"  },
  researcher:   { name: "Market Researcher", icon: "🔍", color: "#F4A261", short: "RSRCH" },
  creator:      { name: "Product Creator",   icon: "🎨", color: "#E76F51", short: "CREAT" },
  listing:      { name: "Listing Manager",   icon: "📋", color: "#2A9D8F", short: "LIST"  },
  customer:     { name: "Customer Service",  icon: "💬", color: "#457B9D", short: "CX"    },
  analytics:    { name: "Analytics Agent",   icon: "📊", color: "#8338EC", short: "ANLYT" },
};

const Agents = {
  orchestrator: (storeState: object, goal: string) => callAgent(
    `You are the Orchestrator AI for an autonomous Etsy store. Coordinate 5 specialist agents and output a JSON action plan.`,
    `Store state: ${JSON.stringify(storeState)}\nUser goal: "${goal}"\nOutput JSON: { "strategy": "...", "tasks": [{ "agent": "researcher|creator|listing|customer|analytics", "task": "...", "priority": "high|medium|low" }], "reasoning": "..." }`,
    true
  ),
  researcher: (niche: string, products: string[]) => callAgent(
    `You are a Market Research AI for an Etsy store. Output actionable JSON insights.`,
    `Research niche: "${niche}"\nExisting products: ${JSON.stringify(products)}\nOutput JSON: { "trending_keywords": ["..."], "product_opportunities": [{ "product": "...", "reason": "...", "estimated_price": "$X-$Y", "competition": "low|medium|high", "demand": "low|medium|high" }], "competitor_insights": "...", "recommended_focus": "..." }`,
    true
  ),
  creator: (idea: string, keywords: string[]) => callAgent(
    `You are a Product Creator AI for an Etsy digital products store. Output ready-to-publish JSON.`,
    `Product idea: "${idea}"\nTarget keywords: ${JSON.stringify(keywords)}\nOutput JSON: { "title": "...", "description": "...", "tags": ["..."], "price": "$X.XX", "category": "...", "files_included": ["..."], "mockup_prompt": "..." }`,
    true
  ),
  listing: (product: object, metrics: object) => callAgent(
    `You are a Listing Manager AI for an Etsy store. Optimize for visibility and conversion.`,
    `Product: ${JSON.stringify(product)}\nMetrics: ${JSON.stringify(metrics)}\nOutput JSON: { "seo_score": 85, "optimizations": ["..."], "price_recommendation": "$X.XX", "title_variant": "...", "top_tags_to_add": ["..."], "listing_status": "ready|needs_work", "predicted_monthly_sales": "X-Y units" }`,
    true
  ),
  customer: (messages: object[], history: object) => callAgent(
    `You are a Customer Service AI for an Etsy store. Handle inquiries with warmth and efficiency.`,
    `Messages: ${JSON.stringify(messages)}\nHistory: ${JSON.stringify(history)}\nOutput JSON: { "responses": [{ "to": "...", "subject": "...", "message": "...", "action": "resolve|escalate|refund|follow_up" }], "review_requests": ["..."], "flagged_issues": ["..."], "satisfaction_score": 9.2 }`,
    true
  ),
  analytics: (sales: object, listings: object[]) => callAgent(
    `You are an Analytics AI for an Etsy store. Provide data-driven recommendations.`,
    `Sales: ${JSON.stringify(sales)}\nListings: ${JSON.stringify(listings)}\nOutput JSON: { "revenue_this_month": "$X,XXX", "revenue_trend": "+X%", "top_performers": [{ "product": "...", "units": 0, "revenue": "$XXX" }], "underperformers": [{ "product": "...", "issue": "...", "action": "..." }], "conversion_rate": "X.X%", "key_insights": ["..."], "next_actions": ["..."] }`,
    true
  ),
};

const INITIAL_STATE = {
  storeInfo: { name: "", niche: "", rating: 0, totalSales: 0 },
  listings: [],
  messages: [],
  salesData: { thisMonth: 0, lastMonth: 0, orders: 0, avgOrderValue: 0 },
};

// ── Sub-components ────────────────────────────────────────────
function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ background: color + "22", border: `1px solid ${color}44`, color, borderRadius: 100, padding: "2px 10px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
      {children}
    </span>
  );
}

function AgentAvatar({ agentId, size = 36, pulse = false }: { agentId: string; size?: number; pulse?: boolean }) {
  const m = AGENT_META[agentId];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: m.color + "22", border: `2px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45, flexShrink: 0, boxShadow: pulse ? `0 0 12px ${m.color}88` : "none", transition: "box-shadow 0.3s" }}>
      {m.icon}
    </div>
  );
}

function ThinkingDots({ color }: { color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", marginLeft: 6 }}>
      {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: color, animation: `dot 1.2s ${i * 0.2}s ease-in-out infinite`, display: "inline-block" }} />)}
    </span>
  );
}

function JsonViewer({ data, color }: { data: unknown; color: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: `1px solid ${color}44`, color, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
        {open ? "▲ Hide" : "▼ View"} JSON output
      </button>
      {open && <pre style={{ marginTop: 8, background: "#0a0a0a", border: `1px solid ${color}33`, borderRadius: 8, padding: 12, fontSize: 11, color: "#aaa", overflowX: "auto", maxHeight: 300, lineHeight: 1.6 }}>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

interface Run { id: number; agentId: string; task: string; status: "running"|"done"|"error"; result: unknown; error: string|null; time: string; }

function RunCard({ run, onExpand, expanded }: { run: Run; onExpand: () => void; expanded: boolean }) {
  const m = AGENT_META[run.agentId];
  return (
    <div onClick={onExpand} style={{ background: "#0e0e0e", border: `1px solid ${expanded ? m.color + "55" : "#1e1e1e"}`, borderLeft: `3px solid ${m.color}`, borderRadius: 12, padding: "14px 16px", transition: "border-color 0.2s", cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <AgentAvatar agentId={run.agentId} pulse={run.status === "running"} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, color: m.color, fontSize: 13 }}>{m.name}</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {run.status === "running" && <Badge color={m.color}>Running<ThinkingDots color={m.color} /></Badge>}
              {run.status === "done"    && <Badge color="#4ade80">✓ Done</Badge>}
              {run.status === "error"   && <Badge color="#f87171">✗ Error</Badge>}
              <span style={{ fontSize: 10, color: "#444" }}>{run.time}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: run.result ? 6 : 0 }}>{run.task}</div>
          {run.status === "done" && run.result && expanded && <JsonViewer data={run.result} color={m.color} />}
          {run.status === "error" && <div style={{ fontSize: 12, color: "#f87171", marginTop: 4 }}>⚠ {run.error}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export default function EtsyMindAI() {
  const [tab, setTab]                     = useState("command");
  const [storeState, setStoreState]       = useState(INITIAL_STATE);
  const [runs, setRuns]                   = useState<Run[]>([]);
  const [expandedRun, setExpandedRun]     = useState<number|null>(null);
  const [goal, setGoal]                   = useState("");
  const [isRunning, setIsRunning]         = useState(false);
  const [systemLog, setSystemLog]         = useState<Array<{id:number;agentId:string;msg:string;type:string;time:string}>>([]);
  const [researchResult, setResearchResult]   = useState<unknown>(null);
  const [creatorResult,  setCreatorResult]    = useState<unknown>(null);
  const [listingResult,  setListingResult]    = useState<unknown>(null);
  const [analyticsResult,setAnalyticsResult]  = useState<unknown>(null);
  const [cxResult,       setCxResult]         = useState<unknown>(null);
  const [orchResult,     setOrchResult]       = useState<unknown>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const log = useCallback((agentId: string, msg: string, type = "info") => {
    setSystemLog(prev => [{ id: Date.now() + Math.random(), agentId, msg, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)]);
  }, []);

  const addRun = useCallback((agentId: string, task: string): number => {
    const id = Date.now() + Math.random();
    setRuns(prev => [{ id, agentId, task, status: "running", result: null, error: null, time: new Date().toLocaleTimeString() }, ...prev]);
    return id;
  }, []);

  const finishRun = useCallback((id: number, result: unknown) => setRuns(prev => prev.map(r => r.id === id ? { ...r, status: "done" as const, result } : r)), []);
  const errorRun  = useCallback((id: number, error: string)  => setRuns(prev => prev.map(r => r.id === id ? { ...r, status: "error" as const, error } : r)), []);

  const runPipeline = async () => {
    if (!goal.trim() || isRunning) return;
    setIsRunning(true); setExpandedRun(null);

    // 1. Orchestrator
    log("orchestrator", `Planning: "${goal}"`);
    const orchId = addRun("orchestrator", `Strategize: "${goal}"`);
    let orchPlan: unknown;
    try {
      orchPlan = await Agents.orchestrator(storeState, goal);
      setOrchResult(orchPlan); finishRun(orchId, orchPlan); setExpandedRun(orchId);
      log("orchestrator", `Strategy ready`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(orchId, msg); log("orchestrator", msg, "error"); setIsRunning(false); return; }

    // 2. Researcher
    await new Promise(r => setTimeout(r, 500));
    log("researcher", "Scanning market trends...");
    const resId = addRun("researcher", `Research: ${storeState.storeInfo.niche}`);
    let resData: Record<string, unknown> = {};
    try {
      resData = await Agents.researcher(storeState.storeInfo.niche, storeState.listings.map(l => l.title));
      setResearchResult(resData); finishRun(resId, resData);
      log("researcher", `Found ${(resData.product_opportunities as unknown[])?.length || 0} opportunities`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(resId, msg); log("researcher", msg, "error"); }

    // 3. Creator
    await new Promise(r => setTimeout(r, 500));
    const idea = (resData.product_opportunities as Array<{product:string}>)?.[0]?.product || "Digital Printable Planner";
    const kws  = (resData.trending_keywords as string[]) || ["printable","digital","planner"];
    log("creator", `Creating: "${idea}"`);
    const creatId = addRun("creator", `Create: "${idea}"`);
    let created: Record<string, unknown> = {};
    try {
      created = await Agents.creator(idea, kws);
      setCreatorResult(created); finishRun(creatId, created);
      log("creator", `Listing ready: "${(created.title as string)?.slice(0,50)}..."`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(creatId, msg); log("creator", msg, "error"); }

    // 4. Listing Manager
    await new Promise(r => setTimeout(r, 500));
    log("listing", "Optimizing listing...");
    const listId = addRun("listing", `Optimize: "${(created.title as string)?.slice(0,40) || idea}"`);
    try {
      const listData = await Agents.listing(created, storeState.salesData) as Record<string, unknown>;
      setListingResult(listData); finishRun(listId, listData);
      if (created.title) {
        setStoreState(prev => ({ ...prev, listings: [...prev.listings, { id: `L${String(prev.listings.length+1).padStart(3,"0")}`, title: (created.title as string).slice(0,60), price: (created.price as string) || "$5.99", status: listData.listing_status === "ready" ? "active" : "draft", views: 0, sales: 0 }] }));
      }
      log("listing", `SEO: ${listData.seo_score}/100 — ${listData.listing_status}`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(listId, msg); log("listing", msg, "error"); }

    // 5. Customer Service
    await new Promise(r => setTimeout(r, 500));
    log("customer", `Handling ${storeState.messages.length} messages...`);
    const cxId = addRun("customer", `Handle ${storeState.messages.length} messages`);
    try {
      const cxData = await Agents.customer(storeState.messages, storeState.salesData) as Record<string, unknown>;
      setCxResult(cxData); finishRun(cxId, cxData);
      log("customer", `${(cxData.responses as unknown[])?.length || 0} responses drafted`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(cxId, msg); log("customer", msg, "error"); }

    // 6. Analytics
    await new Promise(r => setTimeout(r, 500));
    log("analytics", "Running analysis...");
    const anlId = addRun("analytics", "Full analytics report");
    try {
      const anlData = await Agents.analytics(storeState.salesData, storeState.listings) as Record<string, unknown>;
      setAnalyticsResult(anlData); finishRun(anlId, anlData);
      log("analytics", `Revenue: ${anlData.revenue_this_month} (${anlData.revenue_trend})`);
    } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); errorRun(anlId, msg); log("analytics", msg, "error"); }

    log("orchestrator", "✅ Pipeline complete.");
    setIsRunning(false);
  };

  const runAgent = async (agentId: string) => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      if (agentId === "researcher") {
        const id = addRun("researcher", `Research: ${storeState.storeInfo.niche}`);
        try { const r = await Agents.researcher(storeState.storeInfo.niche, storeState.listings.map(l=>l.title)); setResearchResult(r); finishRun(id,r); setExpandedRun(id); } catch(e:unknown){const m=e instanceof Error?e.message:String(e);errorRun(id,m);}
      } else if (agentId === "creator") {
        const idea = (researchResult as Record<string,unknown[]>)?.product_opportunities?.[0] ? ((researchResult as Record<string,Array<{product:string}>>).product_opportunities[0].product) : "Minimalist Digital Planner";
        const kws  = (researchResult as Record<string,string[]>)?.trending_keywords || ["planner","printable","digital"];
        const id = addRun("creator", `Create: "${idea}"`);
        try { const r = await Agents.creator(idea, kws); setCreatorResult(r); finishRun(id,r); setExpandedRun(id); } catch(e:unknown){const m=e instanceof Error?e.message:String(e);errorRun(id,m);}
      } else if (agentId === "listing") {
        const id = addRun("listing", "Optimize listings");
        try { const r = await Agents.listing(creatorResult || storeState.listings[0], storeState.salesData); setListingResult(r); finishRun(id,r); setExpandedRun(id); } catch(e:unknown){const m=e instanceof Error?e.message:String(e);errorRun(id,m);}
      } else if (agentId === "customer") {
        const id = addRun("customer", `Handle ${storeState.messages.length} messages`);
        try { const r = await Agents.customer(storeState.messages, storeState.salesData); setCxResult(r); finishRun(id,r); setExpandedRun(id); } catch(e:unknown){const m=e instanceof Error?e.message:String(e);errorRun(id,m);}
      } else if (agentId === "analytics") {
        const id = addRun("analytics", "Analytics report");
        try { const r = await Agents.analytics(storeState.salesData, storeState.listings); setAnalyticsResult(r); finishRun(id,r); setExpandedRun(id); } catch(e:unknown){const m=e instanceof Error?e.message:String(e);errorRun(id,m);}
      }
    } finally { setIsRunning(false); }
  };

  const activeCount = runs.filter(r => r.status === "running").length;

  return (
    <div style={{ minHeight: "100vh", background: "#070707", color: "#e8e8e8", fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:4px}
        @keyframes dot{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        textarea:focus,input:focus{outline:none}button:active{opacity:0.8}
      `}</style>

      {/* TOP BAR */}
      <div style={{ background: "#0b0b0b", borderBottom: "1px solid #1a1a1a", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, background: "linear-gradient(90deg,#F4A261,#E76F51,#FB5607)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>EtsyMind AI</div>
          <div style={{ width: 1, height: 20, background: "#222" }} />
          <div style={{ fontSize: 12, color: "#555" }}>{storeState.storeInfo.name}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activeCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FB560718", border: "1px solid #FB560733", borderRadius: 100, padding: "4px 12px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FB5607", animation: "pulse 1s infinite" }} />
              <span style={{ fontSize: 12, color: "#FB5607" }}>{activeCount} agent{activeCount>1?"s":""} running</span>
            </div>
          )}
          <div style={{ display: "flex", gap: 2, background: "#111", borderRadius: 8, padding: 3 }}>
            {["command","agents","store","results","log"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ background: tab===t?"#1e1e1e":"none", border: "none", color: tab===t?"#e8e8e8":"#555", borderRadius: 6, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: tab===t?600:400, textTransform: "capitalize", transition: "all 0.15s" }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

        {/* COMMAND TAB */}
        {tab === "command" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, marginBottom: 4 }}>Command Center</div>
                <div style={{ color: "#555", fontSize: 13 }}>Direct the entire agent system with a natural language goal</div>
              </div>
              <div style={{ background: "#0e0e0e", border: "1px solid #222", borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>🧠 Your Goal</div>
                <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. 'Find trending products and create 3 new listings for the holiday season'" style={{ width: "100%", background: "#111", border: "1px solid #222", borderRadius: 10, color: "#e8e8e8", fontSize: 14, padding: "12px 14px", resize: "vertical", minHeight: 90, fontFamily: "inherit", lineHeight: 1.6 }} />
                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  {["Find trending niches and create new products","Optimize all listings for better SEO","Handle all customer messages and request reviews","Run full store analytics and report insights"].map(s => (
                    <button key={s} onClick={() => setGoal(s)} style={{ background: "#161616", border: "1px solid #2a2a2a", color: "#888", borderRadius: 100, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
                  ))}
                </div>
              </div>
              <button onClick={runPipeline} disabled={isRunning||!goal.trim()} style={{ width: "100%", padding: "16px", borderRadius: 12, background: isRunning||!goal.trim()?"#1a1a1a":"linear-gradient(135deg,#F4A261,#E76F51,#FB5607)", border: "none", color: isRunning||!goal.trim()?"#444":"#fff", fontSize: 15, fontWeight: 700, fontFamily: "'Syne',sans-serif", cursor: isRunning||!goal.trim()?"not-allowed":"pointer", letterSpacing: 0.5, transition: "all 0.2s", boxShadow: isRunning||!goal.trim()?"none":"0 4px 20px #F4A26144", marginBottom: 20 }}>
                {isRunning ? "🔄  Agents Running..." : "🚀  Run Full Pipeline (All 6 Agents)"}
              </button>
              {runs.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Recent Runs</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {runs.slice(0,8).map(run => <RunCard key={run.id} run={run} expanded={expandedRun===run.id} onExpand={() => setExpandedRun(expandedRun===run.id?null:run.id)} />)}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 12, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Store Health</div>
                {[
                  { label: "Monthly Revenue", value: `$${storeState.salesData.thisMonth.toLocaleString()}`, color: "#4ade80" },
                  { label: "Total Orders",     value: storeState.salesData.orders,                          color: "#60a5fa" },
                  { label: "Active Listings",  value: storeState.listings.filter(l=>l.status==="active").length, color: "#F4A261" },
                  { label: "Store Rating",     value: `${storeState.storeInfo.rating} ★`,                   color: "#fbbf24" },
                  { label: "Total Sales",      value: storeState.storeInfo.totalSales,                      color: "#a78bfa" },
                ].map(m => (
                  <div key={m.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #141414" }}>
                    <span style={{ color: "#666", fontSize: 12 }}>{m.label}</span>
                    <span style={{ color: m.color, fontWeight: 700, fontSize: 13, fontFamily: "'Syne',sans-serif" }}>{m.value}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 16, padding: 18 }}>
                <div style={{ fontSize: 12, color: "#444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Live Activity</div>
                {systemLog.length === 0 ? <div style={{ color: "#333", fontSize: 12, textAlign: "center", padding: "20px 0" }}>No activity yet</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                    {systemLog.slice(0,10).map(entry => {
                      const m = AGENT_META[entry.agentId];
                      return (
                        <div key={entry.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "fadeIn 0.2s ease" }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>{m.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: entry.type==="error"?"#f87171":"#888", lineHeight: 1.4, display: "block" }}>{entry.msg}</span>
                            <span style={{ fontSize: 10, color: "#333" }}>{entry.time}</span>
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

        {/* AGENTS TAB */}
        {tab === "agents" && (
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Agent Network</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Run individual agents or the full pipeline</div>
            <div style={{ background: "#0e0e0e", border: "1px solid #FB560733", borderLeft: "4px solid #FB5607", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <AgentAvatar agentId="orchestrator" size={48} />
                  <div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, color: "#FB5607" }}>🧠 Orchestrator</div>
                    <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>Coordinates all agents • Sets priorities • Synthesizes strategy</div>
                  </div>
                </div>
                <button onClick={runPipeline} disabled={isRunning||!goal.trim()} style={{ background: isRunning?"#1a1a1a":"linear-gradient(135deg,#F4A261,#FB5607)", border: "none", color: isRunning?"#444":"#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: isRunning?"not-allowed":"pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  {isRunning?"Running...":"Run Pipeline"}
                </button>
              </div>
              {orchResult && (
                <div style={{ marginTop: 16, background: "#0a0a0a", borderRadius: 8, padding: 12, fontSize: 12, color: "#aaa", lineHeight: 1.6 }}>
                  <strong style={{ color: "#e8e8e8" }}>Strategy:</strong> {(orchResult as Record<string,string>).strategy}<br />
                  <strong style={{ color: "#e8e8e8" }}>Reasoning:</strong> {(orchResult as Record<string,string>).reasoning}
                </div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {([
                { id:"researcher", desc:"Scans Etsy trends, competitor pricing, keyword opportunities", btnLabel:"Run Research" },
                { id:"creator",    desc:"Generates SEO titles, descriptions, tags, pricing",            btnLabel:"Create Product" },
                { id:"listing",    desc:"Optimizes listing SEO, A/B tests titles, adjusts pricing",     btnLabel:"Optimize Listings" },
                { id:"customer",   desc:"Drafts message responses, requests reviews, handles refunds",  btnLabel:"Handle Messages" },
                { id:"analytics",  desc:"Tracks revenue, conversion rates, top/underperforming products", btnLabel:"Run Analytics" },
              ] as Array<{id:string;desc:string;btnLabel:string}>).map(({ id, desc, btnLabel }) => {
                const m = AGENT_META[id];
                const resultMap: Record<string,unknown> = { researcher:researchResult, creator:creatorResult, listing:listingResult, customer:cxResult, analytics:analyticsResult };
                const result = resultMap[id];
                return (
                  <div key={id} style={{ background: "#0e0e0e", border: `1px solid ${m.color}22`, borderLeft: `3px solid ${m.color}`, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <AgentAvatar agentId={id} size={40} />
                        <div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: m.color, fontSize: 14 }}>{m.name}</div>
                          {result && <Badge color="#4ade80">✓ Has results</Badge>}
                        </div>
                      </div>
                      <button onClick={() => runAgent(id)} disabled={isRunning} style={{ background: m.color+"22", border: `1px solid ${m.color}44`, color: m.color, borderRadius: 8, padding: "6px 12px", fontSize: 11, cursor: isRunning?"not-allowed":"pointer", fontFamily: "inherit", fontWeight: 600, whiteSpace: "nowrap" }}>{btnLabel}</button>
                    </div>
                    <div style={{ color: "#666", fontSize: 12, lineHeight: 1.5, marginBottom: result?12:0 }}>{desc}</div>
                    {result && <JsonViewer data={result} color={m.color} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STORE TAB */}
        {tab === "store" && (
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Store Manager</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Current listings, messages, and store state</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#2A9D8F" }}>📋 Active Listings ({storeState.listings.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {storeState.listings.map(l => (
                    <div key={l.id} style={{ background: "#111", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#e8e8e8", fontWeight: 500 }}>{l.title.slice(0,45)}...</span>
                        <span style={{ fontSize: 12, color: "#F4A261", fontWeight: 700 }}>{l.price}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Badge color={l.status==="active"?"#4ade80":"#fbbf24"}>{l.status}</Badge>
                        <span style={{ fontSize: 11, color: "#555" }}>{l.views} views · {l.sales} sales</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 16, padding: 20 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 16, color: "#457B9D" }}>💬 Customer Messages ({storeState.messages.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {storeState.messages.map((msg, i) => (
                    <div key={i} style={{ background: "#111", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{msg.from}</span>
                        <span style={{ fontSize: 11, color: "#555" }}>{msg.orderId}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>{msg.issue}</div>
                    </div>
                  ))}
                  {(cxResult as Record<string,Array<{to:string;subject:string;message:string}>>)?.responses?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: "#457B9D", marginBottom: 8 }}>AI Drafted Responses:</div>
                      {(cxResult as Record<string,Array<{to:string;subject:string;message:string}>>).responses.map((r, i) => (
                        <div key={i} style={{ background: "#0a1520", border: "1px solid #457B9D33", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                          <div style={{ fontSize: 11, color: "#457B9D", marginBottom: 4 }}>To: {r.to} — {r.subject}</div>
                          <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>{r.message}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS TAB */}
        {tab === "results" && (
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 4 }}>Agent Results</div>
            <div style={{ color: "#555", fontSize: 13, marginBottom: 24 }}>Outputs from all agent runs</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {([
                { id:"researcher", data:researchResult, label:"Market Research"      },
                { id:"creator",    data:creatorResult,  label:"Created Product"      },
                { id:"listing",    data:listingResult,  label:"Listing Optimization" },
                { id:"analytics",  data:analyticsResult,label:"Analytics Report"     },
                { id:"customer",   data:cxResult,       label:"Customer Service"     },
              ] as Array<{id:string;data:unknown;label:string}>).filter(r => r.data).map(({ id, data, label }) => {
                const m = AGENT_META[id];
                const d = data as Record<string, unknown>;
                return (
                  <div key={id} style={{ background: "#0e0e0e", border: `1px solid ${m.color}33`, borderRadius: 16, padding: 20, animation: "fadeIn 0.3s ease" }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                      <AgentAvatar agentId={id} size={40} />
                      <div>
                        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: m.color, fontSize: 15 }}>{m.name}</div>
                        <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
                      </div>
                      <Badge color="#4ade80">✓ Complete</Badge>
                    </div>
                    {id==="researcher" && <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div><div style={{ fontSize:11, color:"#F4A261", marginBottom:8 }}>Trending Keywords</div><div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>{(d.trending_keywords as string[])?.map(k=><Badge key={k} color="#F4A261">{k}</Badge>)}</div></div>
                      <div><div style={{ fontSize:11, color:"#F4A261", marginBottom:8 }}>Top Opportunity</div>{(d.product_opportunities as Array<{product:string;reason:string;estimated_price:string;competition:string}>)?.[0] && <div style={{ background:"#111", borderRadius:8, padding:10, fontSize:12, lineHeight:1.6 }}><strong style={{ color:"#e8e8e8" }}>{(d.product_opportunities as Array<{product:string;reason:string;estimated_price:string;competition:string}>)[0].product}</strong><br/><span style={{ color:"#888" }}>{(d.product_opportunities as Array<{product:string;reason:string;estimated_price:string;competition:string}>)[0].reason}</span><br/><span style={{ color:"#4ade80" }}>{(d.product_opportunities as Array<{product:string;reason:string;estimated_price:string;competition:string}>)[0].estimated_price}</span></div>}</div>
                      <div style={{ gridColumn:"1/-1", background:"#111", borderRadius:8, padding:10, fontSize:12, color:"#888" }}><strong style={{ color:"#e8e8e8" }}>Recommendation:</strong> {d.recommended_focus as string}</div>
                    </div>}
                    {id==="creator" && <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ background:"#111", borderRadius:8, padding:12 }}><div style={{ fontSize:11, color:"#E76F51", marginBottom:4 }}>Title</div><div style={{ fontSize:13, color:"#e8e8e8" }}>{d.title as string}</div></div>
                      <div style={{ background:"#111", borderRadius:8, padding:12 }}><div style={{ fontSize:11, color:"#E76F51", marginBottom:4 }}>Description</div><div style={{ fontSize:12, color:"#aaa", lineHeight:1.6 }}>{d.description as string}</div></div>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{(d.tags as string[])?.map(t=><Badge key={t} color="#E76F51">{t}</Badge>)}</div>
                      <div style={{ display:"flex", gap:10 }}><Badge color="#4ade80">Price: {d.price as string}</Badge><Badge color="#60a5fa">{d.category as string}</Badge></div>
                    </div>}
                    {id==="listing" && <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:28, color:(d.seo_score as number)>80?"#4ade80":"#fbbf24" }}>{d.seo_score as number}</div>
                        <div style={{ fontSize:12, color:"#555" }}>SEO Score / 100</div>
                        <Badge color={d.listing_status==="ready"?"#4ade80":"#fbbf24"}>{d.listing_status as string}</Badge>
                      </div>
                      {(d.optimizations as string[])?.map((o,i)=><div key={i} style={{ fontSize:12, color:"#aaa", padding:"4px 0", borderBottom:"1px solid #141414" }}>• {o}</div>)}
                    </div>}
                    {id==="analytics" && <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                      {[{label:"Revenue",value:d.revenue_this_month as string,color:"#4ade80"},{label:"Trend",value:d.revenue_trend as string,color:"#60a5fa"},{label:"CVR",value:d.conversion_rate as string,color:"#a78bfa"}].map(mm=><div key={mm.label} style={{ background:"#111", borderRadius:10, padding:12, textAlign:"center" }}><div style={{ fontSize:20, fontWeight:700, color:mm.color, fontFamily:"'Syne',sans-serif" }}>{mm.value}</div><div style={{ fontSize:11, color:"#555" }}>{mm.label}</div></div>)}
                      <div style={{ gridColumn:"1/-1" }}>{(d.key_insights as string[])?.map((ins,i)=><div key={i} style={{ fontSize:12, color:"#aaa", padding:"5px 0", borderBottom:"1px solid #141414" }}>💡 {ins}</div>)}</div>
                    </div>}
                    {id==="customer" && <div>
                      <div style={{ display:"flex", gap:10, marginBottom:12 }}><Badge color="#457B9D">{(d.responses as unknown[])?.length||0} responses</Badge><Badge color="#4ade80">Satisfaction: {d.satisfaction_score as number}/10</Badge></div>
                      {(d.responses as Array<{to:string;subject:string;message:string;action:string}>)?.map((r,i)=><div key={i} style={{ background:"#111", borderRadius:8, padding:12, marginBottom:8 }}><div style={{ fontSize:11, color:"#457B9D", marginBottom:4 }}>To: {r.to} | {r.subject}</div><div style={{ fontSize:12, color:"#aaa", lineHeight:1.5 }}>{r.message}</div><div style={{ marginTop:6 }}><Badge color="#888">{r.action}</Badge></div></div>)}
                    </div>}
                    <JsonViewer data={data} color={m.color} />
                  </div>
                );
              })}
              {!researchResult && !creatorResult && !listingResult && !analyticsResult && !cxResult && (
                <div style={{ textAlign:"center", padding:"60px 20px", color:"#333" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🤖</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, marginBottom:6, color:"#444" }}>No results yet</div>
                  <div style={{ fontSize:13 }}>Run the full pipeline or individual agents to see results here</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, marginBottom:4 }}>System Log</div>
                <div style={{ color:"#555", fontSize:13 }}>Real-time agent activity</div>
              </div>
              <button onClick={() => setSystemLog([])} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", color:"#666", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Clear Log</button>
            </div>
            <div ref={feedRef} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:16, padding:16, fontFamily:"'Space Mono',monospace", fontSize:12, maxHeight:"70vh", overflowY:"auto" }}>
              {systemLog.length===0 ? <div style={{ color:"#333", textAlign:"center", padding:"40px 0" }}>$ waiting for agent activity...</div> : (
                systemLog.map(entry => {
                  const m = AGENT_META[entry.agentId];
                  return (
                    <div key={entry.id} style={{ display:"flex", gap:12, padding:"6px 0", borderBottom:"1px solid #111", animation:"fadeIn 0.2s ease" }}>
                      <span style={{ color:"#333", flexShrink:0 }}>{entry.time}</span>
                      <span style={{ color:m.color, flexShrink:0, width:60 }}>[{m.short}]</span>
                      <span style={{ color:entry.type==="error"?"#f87171":"#888" }}>{entry.msg}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
