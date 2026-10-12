"use client";

import { useState, useEffect } from "react";
import ModelDropdown from "./model-dropdown";

export default function EtsyMindAI() {
  const [model, setModel] = useState("hermes-3-mini-128k");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-gradient-to-b from-[#06060a] to-[#0a0a0f] border border-[#1a1a22] rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">EtsyMind AI</h1>
              <p className="text-[#64748b] text-sm mt-1">
                Your autonomous Etsy store manager — powered by Hermes
              </p>
            </div>
            <ModelDropdown
              value={model}
              onChange={setModel}
            />
          </div>

          <div className="bg-[#06060a] border border-[#1a1a22] rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm text-[#64748b]">Connected to Hermes proxy</span>
            </div>
            <div className="text-sm text-[#94a3b8] whitespace-pre-wrap">
              Your AI agent is ready to manage your Etsy store. The model is set to:{" "}
              <span className="text-white font-mono">{model}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#1a1a22] text-xs text-[#64748b]">
            Free models: hermes-3-mini-128k, hermes-3-mini-400k, hermes-3-mini-1m, hermes-3-mini-4m, auto/best-coding, auto/best-reasoning
          </div>
        </div>
      </div>
    </div>
  );
}
