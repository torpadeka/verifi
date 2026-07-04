"use client";

import type { CostLedger } from "@/lib/types";

function usd(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "$" + n.toFixed(6);
  return "$" + n.toFixed(4);
}

export default function CostPanel({
  cost,
  models,
}: {
  cost: CostLedger;
  models: { planner: string; agent: string; analyst: string };
}) {
  const stages = [
    { key: "plan", label: "planning", model: models.planner },
    { key: "act", label: "browser agent", model: models.agent },
    { key: "analyze", label: "analysis", model: models.analyst },
  ];
  const perStage = stages.map((s) => ({
    ...s,
    calls: cost.entries.filter((e) => e.stage === s.key).length,
    charge: cost.entries
      .filter((e) => e.stage === s.key)
      .reduce((a, e) => a + e.customer_charge, 0),
  }));

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-br from-panel to-panel2/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-brand2/15 text-brand2 border border-brand2/30">
            BTL
          </span>
          <h3 className="text-sm font-semibold">Runtime telemetry</h3>
        </div>
        <span className="text-[11px] text-mut">live from <span className="font-mono">x-btl-*</span> headers</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="LLM calls" value={String(cost.calls)} accent="text-fg" />
        <Stat label="Runtime spend" value={usd(cost.total_charge)} accent="text-brand2" mono />
        <Stat
          label="Saved on reruns"
          value={usd(cost.total_saved)}
          accent="text-ok"
          mono
          sub={`${cost.cache_hits} cache hit${cost.cache_hits === 1 ? "" : "s"}`}
        />
        <Stat
          label="Benchmark cost"
          value={usd(cost.total_benchmark)}
          accent="text-mut"
          mono
          sub="market reference"
        />
      </div>

      {/* model routing */}
      <div className="mt-4 pt-4 border-t border-line/60">
        <div className="text-[11px] uppercase tracking-wider text-mut mb-2">
          Model routing
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          {perStage.map((s) => (
            <div
              key={s.key}
              className="rounded-lg border border-line bg-ink/50 px-3 py-2 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-xs text-mut">{s.label}</div>
                <div className="text-[13px] font-mono text-brand2 truncate">{s.model}</div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <div className="text-xs font-mono">{s.calls}×</div>
                <div className="text-[10px] text-mut font-mono">{usd(s.charge)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  mono?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-ink/40 px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-wider text-mut">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${accent} ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-mut mt-0.5">{sub}</div>}
    </div>
  );
}
