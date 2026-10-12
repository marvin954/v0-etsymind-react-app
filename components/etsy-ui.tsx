"use client";

import { cn } from "@/lib/utils";
import { AgentId, AGENT_META } from "@/lib/etsy-types";

interface BadgeProps {
  color: string;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ color, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        className
      )}
      style={{
        background: `${color}22`,
        border: `1px solid ${color}44`,
        color,
      }}
    >
      {children}
    </span>
  );
}

interface AgentAvatarProps {
  agentId: AgentId;
  size?: number;
  pulse?: boolean;
}

export function AgentAvatar({ agentId, size = 36, pulse = false }: AgentAvatarProps) {
  const meta = AGENT_META[agentId];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full transition-shadow duration-300"
      style={{
        width: size,
        height: size,
        background: `${meta.color}22`,
        border: `2px solid ${meta.color}`,
        fontSize: size * 0.45,
        boxShadow: pulse ? `0 0 12px ${meta.color}88` : "none",
      }}
    >
      {meta.icon}
    </div>
  );
}

interface ThinkingDotsProps {
  color: string;
}

export function ThinkingDots({ color }: ThinkingDotsProps) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[5px] w-[5px] rounded-full"
          style={{
            background: color,
            animation: `dot 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}

interface JsonViewerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  color: string;
}

export function JsonViewer({ data, color }: JsonViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer rounded-md border px-2.5 py-1 text-[11px]"
        style={{
          background: "none",
          borderColor: `${color}44`,
          color,
        }}
      >
        {open ? "▲ Hide" : "▼ View"} JSON output
      </button>
      {open && (
        <pre
          className="mt-2 max-h-[300px] overflow-x-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed text-muted-foreground"
          style={{
            background: "#0a0a0a",
            borderColor: `${color}33`,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

import { useState } from "react";
import { Run } from "@/lib/etsy-types";

interface RunCardProps {
  run: Run;
  expanded: boolean;
  onExpand: () => void;
}

export function RunCard({ run, expanded, onExpand }: RunCardProps) {
  const meta = AGENT_META[run.agentId];

  return (
    <div
      className="cursor-pointer rounded-xl border bg-card p-3.5 transition-colors"
      style={{
        borderColor: expanded ? `${meta.color}55` : "#1e1e1e",
        borderLeftWidth: 3,
        borderLeftColor: meta.color,
      }}
      onClick={onExpand}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar agentId={run.agentId} pulse={run.status === "running"} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <span
              className="font-heading text-[13px] font-bold"
              style={{ color: meta.color }}
            >
              {meta.name}
            </span>
            <div className="flex items-center gap-1.5">
              {run.status === "running" && (
                <Badge color={meta.color}>
                  Running
                  <ThinkingDots color={meta.color} />
                </Badge>
              )}
              {run.status === "done" && <Badge color="#4ade80">Done</Badge>}
              {run.status === "error" && <Badge color="#f87171">Error</Badge>}
              <span className="text-[10px] text-muted-foreground">{run.time}</span>
            </div>
          </div>
          <div className="text-xs text-secondary-foreground">{run.task}</div>
          {run.status === "done" && run.result && expanded && (
            <JsonViewer data={run.result} color={meta.color} />
          )}
          {run.status === "error" && (
            <div className="mt-1 text-xs text-destructive">⚠ {run.error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
