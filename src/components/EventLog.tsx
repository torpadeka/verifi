"use client";

import { useEffect, useRef } from "react";
import type { RunEvent } from "@/lib/types";

const color: Record<string, string> = {
  status: "text-[#e6b98a]",
  log: "text-[#a7a6b4]",
  plan: "text-[#e9e8ef]",
  test_start: "text-[#f3f2f7]",
  step: "text-[#8f8ea0]",
  test_end: "text-[#f3f2f7]",
  cost: "text-[#9aa0b8]",
  bug: "text-[#e79b8f]",
  done: "text-[#8fd6b3]",
  error: "text-[#e79b8f]",
};

export default function EventLog({ events, active }: { events: RunEvent[]; active: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  const shown = events.filter((e) => e.message && e.type !== "cost");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [shown.length]);

  return (
    <div className="rounded-card bg-deep overflow-hidden shadow-card">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-dusty" />
          <span className="w-2.5 h-2.5 rounded-full bg-ash" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone" />
        </span>
        <span className="text-[12px] text-white/45 font-mono">verifi · agent log</span>
        {active && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[#8fd6b3]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8fd6b3] animate-pulse-dot" />
            live
          </span>
        )}
      </div>
      <div className="p-3.5 max-h-[70vh] overflow-y-auto font-mono text-[12px] leading-relaxed space-y-0.5">
        {shown.length === 0 && <div className="text-white/30">waiting for events…</div>}
        {shown.map((e, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-white/25 shrink-0">›</span>
            <span className={color[e.type] || "text-white/60"}>{e.message}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
