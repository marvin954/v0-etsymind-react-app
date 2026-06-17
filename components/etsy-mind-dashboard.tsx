"use client";

import { useState, useEffect, useRef } from "react";

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:       "#06060a",
  surface:  "#0d0d12",
  card:     "#111116",
  border:   "#1a1a22",
  borderHi: "#252530",
  amber:    "#f59e0b",
  amberDim: "rgba(245,158,11,0.08)",
  green:    "#10b981",
  greenDim: "rgba(16,185,129,0.08)",
  red:      "#ef4444",
  redDim:   "rgba(239,68,68,0.08)",
  blue:     "#3b82f6",
  blueDim:  "rgba(59,130,246,0.08)",
  purple:   "#8b5cf6",
  text:     "#e2e8f0",
  textDim:  "#64748b",
  textMute: "#1e293b",
  mono:     "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
};

const AGENTS = [
  { id: "market_research", name: "Market Research", icon: "🔍", color: C.blue,   desc: "Finds trending niches" },
  { id: "product_creator", name: "Product Creator", icon: "✍️", color: C.purple, desc: "Writes SEO listings" },
  { id: "full_pipeline",   name: "Full Pipeline",   icon: "⚡", color: C.amber,  desc: "Research → Create → Publish" },
  { id: "analytics",       name: "Analytics",       icon: "📊", color: C.green,  desc: "Store performance report" },
  { id: "listing_manager", name: "Listing Manager", icon: "📋", color: C.blue,   desc: "Optimize existing listings" },
];

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Run {
  id: string;
  agent: string;
  agentName: string;
  agentColor: string;
  agentIcon: string;
  status: "running" | "done" | "error";
  startedAt: string;
  duration?: number;
  result?: any;
  error?: string;
}

interface Listing {
  listing_id: string;
  title: string;
  views: number;
  num_favorers: number;
  price?: { amount: number; divisor: number };
  state: string;
  url?: string;
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
const API = "https://v0-etsymind-react-app-git-main-marvin-stokes-projects.vercel.app";

async function runAgent(agent: string, params?: any) {
  const res = await fetch(`${API}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

function ts() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function Pulse({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: color, flexShrink: 0,
      boxShadow: `0 0 6px ${color}`,
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontFamily: C.mono, fontWeight: 700,
      letterSpacing: "0.12em", color,
      background: `${color}18`, border: `1px solid ${color}30`,
      padding: "2px 8px", borderRadius: 3,
    }}>{children}</span>
  );
}

function StatCard({ label, value, sub, accent = C.text }: { label: string; value: any; sub?: string; accent?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: "18px 22px", flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.12em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 200, fontFamily: C.mono, color: accent, lineHeight: 1, letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontFamily: C.mono, color: C.textMute, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function RunCard({ run, onExpand, expanded }: { run: Run; onExpand: () => void; expanded: boolean }) {
  const dur = run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "";
  return (
    <div
      onClick={onExpand}
      style={{
        background: C.card, border: `1px solid ${expanded ? run.agentColor + "40" : C.border}`,
        borderLeft: `3px solid ${run.agentColor}`,
        padding: "12px 16px", cursor: "pointer", transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ fontSize: 18, lineHeight: 1, marginTop: 1 }}>{run.agentIcon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontFamily: C.mono, fontWeight: 700, color: run.agentColor, letterSpacing: "0.08em" }}>
              {run.agentName.toUpperCase()}
            </span>
            {run.status === "running" && <Pulse color={run.agentColor} />}
            {run.status === "done" && <Tag color={C.green}>DONE {dur}</Tag>}
            {run.status === "error" && <Tag color={C.red}>ERROR</Tag>}
            <span style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginLeft: "auto" }}>{run.startedAt}</span>
          </div>
          {run.status === "error" && (
            <div style={{ fontSize: 11, color: C.red, fontFamily: C.mono, marginTop: 4 }}>{run.error}</div>
          )}
          {run.status === "done" && run.result && expanded && (
            <pre style={{
              marginTop: 10, padding: 12, background: C.bg,
              border: `1px solid ${run.agentColor}20`,
              fontSize: 10, fontFamily: C.mono, color: C.textDim,
              maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all",
            }}>
              {JSON.stringify(run.result, null, 2)}
            </pre>
          )}
          {run.status === "running" && (
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.mono, marginTop: 4 }}>
              Running<span style={{ animation: "ellipsis 1.5s infinite" }}>...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function EtsyMindDashboard() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeTab, setActiveTab] = useState<"activity" | "listings" | "agents">("activity");
  const [niche, setNiche] = useState("Small Business Owner Tools");
  const [loadingListings, setLoadingListings] = useState(false);
  const runsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll runs
  useEffect(() => {
    if (runsRef.current) {
      runsRef.current.scrollTop = 0;
    }
  }, [runs]);

  async function fireAgent(agentId: string, params?: any) {
    const agent = AGENTS.find(a => a.id === agentId)!;
    const runId = `run-${Date.now()}`;
    const startTime = Date.now();

    const newRun: Run = {
      id: runId, agent: agentId,
      agentName: agent.name, agentColor: agent.color, agentIcon: agent.icon,
      status: "running", startedAt: ts(),
    };

    setRuns(prev => [newRun, ...prev]);
    setExpandedRun(runId);
    setActiveTab("activity");

    try {
      const result = await runAgent(agentId, params);
      setRuns(prev => prev.map(r => r.id === runId ? {
        ...r, status: "done", result, duration: Date.now() - startTime,
      } : r));

      // If analytics ran, refresh listings
      if (agentId === "analytics" || agentId === "full_pipeline") {
        loadListings();
      }
    } catch (e: any) {
      setRuns(prev => prev.map(r => r.id === runId ? {
        ...r, status: "error", error: e.message,
      } : r));
    }
  }

  async function loadListings() {
    setLoadingListings(true);
    try {
      const res = await fetch(`${API}/api/etsy/listings`);
      const data = await res.json();
      setListings(data.listings || []);
    } catch {}
    setLoadingListings(false);
  }

  useEffect(() => { loadListings(); }, []);

  const activeRuns = runs.filter(r => r.status === "running").length;
  const totalViews = listings.reduce((s, l) => s + (l.views || 0), 0);
  const totalFaves = listings.reduce((s, l) => s + (l.num_favorers || 0), 0);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 6px currentColor} 50%{opacity:0.5;box-shadow:0 0 12px currentColor} }
        @keyframes ellipsis { 0%{content:'.'} 33%{content:'..'} 66%{content:'...'} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        input { color-scheme: dark; }
        button { cursor: pointer; }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`, padding: "0 28px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: C.surface, position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🛍️</span>
            <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, letterSpacing: "0.15em", color: C.amber }}>
              ETSYMIND
            </span>
          </div>
          <span style={{ width: 1, height: 16, background: C.border }} />
          <span style={{ fontFamily: C.mono, fontSize: 9, color: C.textDim, letterSpacing: "0.18em" }}>
            mvpdealz · AUTONOMOUS MODE
          </span>
          {activeRuns > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Pulse color={C.amber} />
              <span style={{ fontFamily: C.mono, fontSize: 9, color: C.amber, letterSpacing: "0.1em" }}>
                {activeRuns} AGENT{activeRuns > 1 ? "S" : ""} RUNNING
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href="https://www.etsy.com/shop/mvpdealz"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: C.mono, fontSize: 9, color: C.textDim,
              background: "none", border: `1px solid ${C.border}`,
              padding: "5px 12px", textDecoration: "none", letterSpacing: "0.08em",
            }}
          >
            VIEW SHOP ↗
          </a>
          <button
            onClick={() => fireAgent("full_pipeline", { niche })}
            disabled={activeRuns > 0}
            style={{
              fontFamily: C.mono, fontSize: 9, fontWeight: 700,
              color: C.bg, background: activeRuns > 0 ? C.textDim : C.amber,
              border: "none", padding: "6px 16px", letterSpacing: "0.1em",
              opacity: activeRuns > 0 ? 0.6 : 1,
            }}
          >
            ⚡ RUN FULL PIPELINE
          </button>
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 1, background: C.border }}>
        <StatCard label="ACTIVE LISTINGS" value={listings.length} sub="on mvpdealz" accent={C.amber} />
        <StatCard label="TOTAL VIEWS" value={totalViews.toLocaleString()} sub="all time" accent={C.blue} />
        <StatCard label="FAVORITES" value={totalFaves} accent={C.purple} />
        <StatCard label="RUNS TODAY" value={runs.length} sub={`${activeRuns} active`} accent={activeRuns > 0 ? C.green : C.textDim} />
        <StatCard label="CRON SCHEDULE" value="9AM" sub="daily UTC · auto" accent={C.textDim} />
      </div>

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 28px", background: C.surface }}>
        {(["activity", "listings", "agents"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === tab ? C.amber : "transparent"}`,
              padding: "12px 20px", marginBottom: -1,
              fontFamily: C.mono, fontSize: 10, letterSpacing: "0.12em",
              color: activeTab === tab ? C.text : C.textDim,
            }}
          >
            {tab.toUpperCase()}
            {tab === "activity" && runs.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 9, color: C.amber }}>({runs.length})</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── ACTIVITY TAB ─────────────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>
            {/* Run feed */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.12em" }}>AGENT ACTIVITY</div>
                  <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>Live run feed</div>
                </div>
                {runs.length > 0 && (
                  <button
                    onClick={() => setRuns([])}
                    style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, background: "none", border: `1px solid ${C.border}`, padding: "4px 10px" }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
              <div ref={runsRef} style={{ display: "flex", flexDirection: "column", gap: 1, background: C.border }}>
                {runs.length === 0 ? (
                  <div style={{ background: C.card, padding: "60px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>🤖</div>
                    <div style={{ fontSize: 13, color: C.textDim }}>No runs yet. Fire an agent to get started.</div>
                  </div>
                ) : (
                  runs.map(run => (
                    <RunCard
                      key={run.id}
                      run={run}
                      expanded={expandedRun === run.id}
                      onExpand={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Quick fire panel */}
            <div>
              <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>
                QUICK FIRE
              </div>

              {/* Niche input */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, marginBottom: 6, letterSpacing: "0.08em" }}>TARGET NICHE</div>
                <input
                  value={niche}
                  onChange={e => setNiche(e.target.value)}
                  style={{
                    width: "100%", background: C.card, border: `1px solid ${C.border}`,
                    padding: "8px 12px", color: C.text, fontSize: 11, fontFamily: C.mono,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {AGENTS.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => fireAgent(agent.id, agent.id === "full_pipeline" || agent.id === "product_creator" ? { niche } : undefined)}
                    disabled={activeRuns > 0}
                    style={{
                      background: C.card, border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${agent.color}`,
                      padding: "12px 14px", textAlign: "left",
                      opacity: activeRuns > 0 ? 0.5 : 1,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.card)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{agent.icon}</span>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: C.mono, fontWeight: 700, color: agent.color, letterSpacing: "0.08em" }}>
                          {agent.name.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{agent.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Cron info */}
              <div style={{ marginTop: 16, padding: "12px 14px", background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.1em", marginBottom: 6 }}>DAILY CRON</div>
                <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6 }}>
                  Full pipeline runs automatically every day at <span style={{ color: C.amber, fontFamily: C.mono }}>9:00 AM UTC</span>.
                  Research → Create → Generate images → Publish to Etsy.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LISTINGS TAB ─────────────────────────────────────────────────── */}
        {activeTab === "listings" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.12em" }}>STORE LISTINGS</div>
                <div style={{ fontSize: 14, color: C.text, marginTop: 4 }}>{listings.length} active on mvpdealz</div>
              </div>
              <button
                onClick={loadListings}
                style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, background: "none", border: `1px solid ${C.border}`, padding: "5px 12px" }}
              >
                {loadingListings ? "LOADING..." : "↻ REFRESH"}
              </button>
            </div>

            {listings.length === 0 ? (
              <div style={{ padding: "60px 0", textAlign: "center", background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🏪</div>
                <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>No active listings yet.</div>
                <button
                  onClick={() => { setActiveTab("activity"); fireAgent("full_pipeline", { niche }); }}
                  style={{ fontSize: 10, fontFamily: C.mono, color: C.bg, background: C.amber, border: "none", padding: "8px 20px", fontWeight: 700 }}
                >
                  ⚡ RUN FULL PIPELINE
                </button>
              </div>
            ) : (
              <div style={{ background: C.border, display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ background: C.surface, display: "grid", gridTemplateColumns: "3fr 80px 80px 80px 100px", padding: "8px 16px", gap: 0 }}>
                  {["LISTING", "VIEWS", "FAVES", "PRICE", "STATUS"].map(h => (
                    <span key={h} style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.1em" }}>{h}</span>
                  ))}
                </div>
                {listings.map(listing => {
                  const price = listing.price ? (listing.price.amount / listing.price.divisor).toFixed(2) : "—";
                  return (
                    <div
                      key={listing.listing_id}
                      style={{ background: C.card, display: "grid", gridTemplateColumns: "3fr 80px 80px 80px 100px", padding: "12px 16px", alignItems: "center" }}
                    >
                      <div style={{ paddingRight: 16 }}>
                        <div style={{ fontSize: 12, color: C.text, fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {listing.title}
                        </div>
                        <span style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim }}>#{listing.listing_id}</span>
                      </div>
                      <span style={{ fontFamily: C.mono, fontSize: 12, color: C.blue }}>{listing.views || 0}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 12, color: C.purple }}>{listing.num_favorers || 0}</span>
                      <span style={{ fontFamily: C.mono, fontSize: 12, color: C.amber }}>${price}</span>
                      <Tag color={listing.state === "active" ? C.green : C.textDim}>{listing.state.toUpperCase()}</Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AGENTS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "agents" && (
          <div>
            <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim, letterSpacing: "0.12em", marginBottom: 16 }}>AGENT REGISTRY</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 1, background: C.border }}>
              {AGENTS.map(agent => {
                const agentRuns = runs.filter(r => r.agent === agent.id);
                const lastRun = agentRuns[0];
                return (
                  <div key={agent.id} style={{ background: C.card, padding: "20px", borderTop: `3px solid ${agent.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 24 }}>{agent.icon}</span>
                      <div>
                        <div style={{ fontSize: 11, fontFamily: C.mono, fontWeight: 700, color: agent.color, letterSpacing: "0.08em" }}>
                          {agent.name.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{agent.desc}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim }}>RUNS</div>
                        <div style={{ fontSize: 22, fontFamily: C.mono, color: C.text, fontWeight: 200 }}>{agentRuns.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontFamily: C.mono, color: C.textDim }}>LAST STATUS</div>
                        <div style={{ marginTop: 4 }}>
                          {!lastRun && <Tag color={C.textDim}>NEVER RUN</Tag>}
                          {lastRun?.status === "running" && <Tag color={agent.color}>RUNNING</Tag>}
                          {lastRun?.status === "done" && <Tag color={C.green}>SUCCESS</Tag>}
                          {lastRun?.status === "error" && <Tag color={C.red}>FAILED</Tag>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setActiveTab("activity"); fireAgent(agent.id, agent.id === "full_pipeline" || agent.id === "product_creator" ? { niche } : undefined); }}
                      disabled={activeRuns > 0}
                      style={{
                        width: "100%", fontFamily: C.mono, fontSize: 9, fontWeight: 700,
                        color: agent.color, background: `${agent.color}15`,
                        border: `1px solid ${agent.color}40`, padding: "8px 0",
                        letterSpacing: "0.1em", opacity: activeRuns > 0 ? 0.5 : 1,
                      }}
                    >
                      RUN AGENT →
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Cron status */}
            <div style={{ marginTop: 20, padding: "20px", background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.amber}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: C.mono, fontWeight: 700, color: C.amber, letterSpacing: "0.08em" }}>
                  DAILY AUTONOMOUS CRON
                </span>
                <Tag color={C.green}>ACTIVE</Tag>
              </div>
              <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                Runs every day at <span style={{ color: C.amber, fontFamily: C.mono }}>09:00 UTC</span> via Vercel cron.
                Executes: Market Research → Product Creator → DALL-E Mockups → Etsy Publish → Analytics.
                Publishes up to 2 new listings per day automatically.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}