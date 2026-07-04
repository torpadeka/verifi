"use client";

import { useEffect, useState } from "react";

interface LightRun {
  id: string;
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
  done: "bg-ok",
  error: "bg-bad",
  running: "bg-brand2 animate-pulse-dot",
  planning: "bg-warn animate-pulse-dot",
  analyzing: "bg-warn animate-pulse-dot",
  queued: "bg-mut animate-pulse-dot",
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

  if (runs === null)
    return <div className="h-20 rounded-xl shimmer" />;

  if (runs.length === 0)
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-mut text-sm">
        No runs yet. Paste a URL above to launch your first AI QA run.
      </div>
    );

  return (
    <div className="grid gap-2.5">
      {runs.map((r) => (
        <a
          key={r.id}
          href={`/run/${r.id}`}
          className="flex items-center gap-4 rounded-xl border border-line bg-panel/60 hover:bg-panel2 hover:border-brand/40 transition px-4 py-3 group"
        >
          <span className={`w-2 h-2 rounded-full ${dot[r.status] || "bg-mut"}`} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-[15px]">{r.url}</div>
            <div className="text-xs text-mut font-mono">{r.id}</div>
          </div>
          {r.total > 0 && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-ok">{r.passed}✓</span>
              <span className="text-bad">{r.failed}✗</span>
              <span className="text-mut">/ {r.total}</span>
            </div>
          )}
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-mut">{r.status}</div>
            {r.charge > 0 && (
              <div className="text-[11px] font-mono text-brand2">
                ${r.charge.toFixed(5)}
              </div>
            )}
          </div>
          <span className="text-mut group-hover:text-brand2 transition">→</span>
        </a>
      ))}
    </div>
  );
}
