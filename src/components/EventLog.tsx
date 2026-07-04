"use client";

import { useEffect, useRef } from "react";
import type { RunEvent } from "@/lib/types";

const color: Record<string, string> = {
  status: "text-warn",
  log: "text-mut",
  plan: "text-brand2",
  test_start: "text-fg",
  step: "text-mut/80",
  test_end: "text-fg",
  cost: "text-brand2/70",
  bug: "text-bad",
  done: "text-ok",
  error: "text-bad",
};

export default function EventLog({ events, active }: { events: RunEvent[]; active: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  const shown = events.filter((e) => e.message && e.type !== "cost");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown.length]);

  return (
    <div className="rounded-2xl border border-line bg-ink/70 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line/60 bg-panel/50">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-bad/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-warn/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-ok/70" />
        </span>
        <span className="text-xs text-mut font-mono">verifi · agent log</span>
        {active && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-brand2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand2 animate-pulse-dot" />
            live
          </span>
        )}
      </div>
      <div className="p-3 max-h-[70vh] overflow-y-auto font-mono text-[12px] leading-relaxed space-y-0.5">
        {shown.length === 0 && <div className="text-mut/60">waiting for events…</div>}
        {shown.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-mut/40 shrink-0">›</span>
            <span className={color[e.type] || "text-mut"}>{e.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
