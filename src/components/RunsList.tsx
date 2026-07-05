"use client";

import { useEffect, useState } from "react";

interface LightRun {
  id: string;
  mode: string;
  url: string;
  status: string;
  createdAt: number;
  summary?: string;
  passed: number;
  failed: number;
  total: number;
  saved: number;
  charge: number;
}

const dot: Record<string, string> = {
  done: "bg-pass",
  error: "bg-fail",
  running: "bg-carbon animate-pulse-dot",
  planning: "bg-warn animate-pulse-dot",
  analyzing: "bg-warn animate-pulse-dot",
  queued: "bg-pebble animate-pulse-dot",
};

export default function RunsList() {
  const [runs, setRuns] = useState<LightRun[] | null>(null);

  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/runs")
        .then((r) => r.json())
        .then((d) => live && setRuns(d.runs || []))
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  if (runs === null) return <div className="h-20 rounded-card shimmer" />;

  if (runs.length === 0)
    return (
      <div className="rounded-card border border-dashed border-line2/60 bg-snow/50 p-8 text-center text-stone text-[14px]">
        No runs yet. Paste a URL above to launch your first AI QA run.
      </div>
    );

  return (
    <div className="grid gap-3">
      {runs.map((r) => (
        <a
          key={r.id}
          href={`/run/${r.id}`}
          className="flex items-center gap-4 rounded-card bg-snow shadow-subtle hover:shadow-card px-5 py-4 group transition"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot[r.status] || "bg-pebble"}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded-badge bg-fog text-graphite text-[10px] font-medium uppercase tracking-[0.06em] shrink-0">
                {r.mode === "api" ? "API" : "UI"}
              </span>
              <span className="truncate font-medium text-[15px] text-carbon">{r.url}</span>
            </div>
            <div className="text-[12px] text-pebble">{r.id}</div>
          </div>
          {r.total > 0 && (
            <div className="hidden sm:flex items-center gap-2.5 text-[13px]">
              <span className="text-pass font-medium">{r.passed}✓</span>
              <span className="text-fail font-medium">{r.failed}✗</span>
              <span className="text-pebble">/ {r.total}</span>
            </div>
          )}
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.06em] text-stone">{r.status}</div>
            {r.charge > 0 && (
              <div className="text-[12px] text-graphite tabular-nums">${r.charge.toFixed(5)}</div>
            )}
          </div>
          <span className="text-pebble group-hover:text-carbon transition">→</span>
        </a>
      ))}
    </div>
  );
}
