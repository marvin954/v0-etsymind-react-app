"use client";

import { useState, useEffect, useCallback } from "react";
import ModelDropdown from "./model-dropdown";
import { Badge, AgentAvatar, ThinkingDots, JsonViewer, RunCard } from "./etsy-ui";
import {
  Agents,
  AGENT_META,
  StoreState,
  Run,
  INITIAL_STATE,
} from "@/lib/etsy-types";
import { runOrchestrator, runResearcher, runCreator, runListingManager, runCustomerService, runAnalytics } from "@/lib/agents";

const INITIAL_STORE_STATE: StoreState = INITIAL_STATE;

export default function EtsyMindAI() {
  const [model, setModel] = useState("hermes-3-mini-128k");
  const [storeState, setStoreState] = useState<StoreState>(INITIAL_STORE_STATE);
  const [runs, setRuns] = useState<Run[]>([]);
  const [status, setStatus] = useState<"running" | "idle" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [history, setHistory] = useState<{ from: string; issue: string; orderId: string }[]>(
    storeState.messages
  );

  const addRun = useCallback((agentId: string, task: string, status: Run["status"], result?: any, error?: string) => {
    setRuns(prev => [
      { id: Date.now(), agentId, task, status, result, error, time: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  }, []);

  const handleRun = async (agentId: string, task: string) => {
    setStatus("running");
    setStatusMessage(`Running ${AGENT_META[agentId as keyof typeof AGENT_META].name} agent...`);
    addRun(agentId, task, "running");

    try {
      let result: any;
      switch (agentId) {
        case "orchestrator":
          result = await runOrchestrator(storeState, task);
          break;
        case "researcher":
          result = await runResearcher(storeState.niche, storeState.listings.map(l => l.title));
          break;
        case "creator":
          result = await runCreator(task, storeState.listings.map(l => l.title));
          break;
        case "listing":
          result = await runListingManager({ title: task, price: "$5.99", status: "active", id: "test", views: 0, sales: 0 }, storeState);
          break;
        case "customer":
          result = await runCustomerService(history, storeState);
          break;
        case "analytics":
          result = await runAnalytics(storeState.salesData, storeState.listings);
          break;
        default:
          result = { error: "Unknown agent" };
      }
      addRun(agentId, task, "done", result);
      setStatus("idle");
      setStatusMessage("Done");
    } catch (err: any) {
      addRun(agentId, task, "error", null, err.message || String(err));
      setStatus("error");
      setStatusMessage(err.message || String(err));
    }
  };

  const runOrchestrator = async () => handleRun("orchestrator", "Analyze the Etsy store and create an action plan");
  const runResearcher = async () => handleRun("researcher", "Find trending products in the minimalist printables niche");
  const runCreator = async () => handleRun("creator", "Create a new product listing for a minimalist daily planner");
  const runListingManager = async () => handleRun("listing", "Optimize the Daily Planner listing for SEO");

  const runCustomerService = async () => {
    setHistory(prev => [
      ...prev,
      { from: "Customer", issue: "Question about download", orderId: "ORD-9999" },
    ]);
    handleRun("customer", "Reply to customer about their issue");
  };

  const runAnalytics = async () => handleRun("analytics", "Analyze monthly sales and provide insights");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-gradient-to-b from-[#06060a] to-[#0a0a0f] border border-[#1a1a22] rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">EtsyMind AI</h1>
              <p className="text-[#64748b] text-sm mt-1">Your autonomous Etsy store manager — powered by Hermes</p>
            </div>
            <ModelDropdown value={model} onChange={setModel} />
          </div>

          <div className="bg-[#06060a] border border-[#1a1a22] rounded-lg p-4 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-[#64748b]">Connected to Hermes proxy</span>
            </div>
            <div className="text-sm text-[#94a3b8] whitespace-pre-wrap">
              Your AI agent is ready to manage your Etsy store. The model is set to:{" "}
              <span className="text-white font-mono">{model}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-[#06060a] border border-[#1a1a22] rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Agent Dashboard</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={runOrchestrator}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#FB5607]/20 border border-[#FB5607]/40 text-[#FB5607] hover:bg-[#FB5607]/30 transition-colors"
                >
                  <AgentAvatar agentId="orchestrator" size={20} />
                  Orchestrator
                </button>
                <button
                  onClick={runResearcher}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#F4A261]/20 border border-[#F4A261]/40 text-[#F4A261] hover:bg-[#F4A261]/30 transition-colors"
                >
                  <AgentAvatar agentId="researcher" size={20} />
                  Market Researcher
                </button>
                <button
                  onClick={runCreator}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#E76F51]/20 border border-[#E76F51]/40 text-[#E76F51] hover:bg-[#E76F51]/30 transition-colors"
                >
                  <AgentAvatar agentId="creator" size={20} />
                  Product Creator
                </button>
                <button
                  onClick={runListingManager}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#2A9D8F]/20 border border-[#2A9D8F]/40 text-[#2A9D8F] hover:bg-[#2A9D8F]/30 transition-colors"
                >
                  <AgentAvatar agentId="listing" size={20} />
                  Listing Manager
                </button>
                <button
                  onClick={runCustomerService}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#457B9D]/20 border border-[#457B9D]/40 text-[#457B9D] hover:bg-[#457B9D]/30 transition-colors"
                >
                  <AgentAvatar agentId="customer" size={20} />
                  Customer Service
                </button>
                <button
                  onClick={runAnalytics}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#8338EC]/20 border border-[#8338EC]/40 text-[#8338EC] hover:bg-[#8338EC]/30 transition-colors"
                >
                  <AgentAvatar agentId="analytics" size={20} />
                  Analytics Agent
                </button>
              </div>
            </div>

            <div className="bg-[#06060a] border border-[#1a1a22] rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Current Store State</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#64748b]">Store:</span><span className="text-white">{storeState.storeInfo.name}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">Niche:</span><span className="text-white">{storeState.storeInfo.niche}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">Rating:</span><span className="text-white">{storeState.storeInfo.rating}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">Total Sales:</span><span className="text-white">{storeState.storeInfo.totalSales}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">Active Listings:</span><span className="text-white">{storeState.listings.length}</span></div>
                <div className="flex justify-between"><span className="text-[#64748b]">This Month:</span><span className="text-white">${storeState.salesData.thisMonth.toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-bold mb-3">Agent Run History</h2>
            {runs.length === 0 ? (
              <p className="text-[#64748b] text-sm">Run an agent to see its results.</p>
            ) : (
              <div className="space-y-3">
                {runs.map(run => (
                  <RunCard
                    key={run.id}
                    run={run}
                    expanded={false}
                    onExpand={() => {}}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-[#1a1a22] text-xs text-[#64748b]">
            Free models: hermes-3-mini-128k, hermes-3-mini-400k, hermes-3-mini-1m, hermes-3-mini-4m, auto/best-coding, auto/best-reasoning
          </div>
        </div>
      </div>
    </div>
  );
}
