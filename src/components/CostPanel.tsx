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
    <div className="rounded-card bg-snow shadow-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] px-2.5 py-0.5 rounded-badge bg-fog text-graphite font-medium">
            BTL
          </span>
          <h3 className="text-[15px] font-medium text-carbon">Runtime telemetry</h3>
        </div>
        <span className="text-[12px] text-pebble">
          live from <span className="text-graphite">x-btl-*</span> headers
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="LLM calls" value={String(cost.calls)} accent="text-carbon" />
        <Stat label="Runtime spend" value={usd(cost.total_charge)} accent="text-carbon" />
        <Stat
          label="Saved on reruns"
          value={usd(cost.total_saved)}
          accent="text-pass"
          sub={`${cost.cache_hits} cache hit${cost.cache_hits === 1 ? "" : "s"}`}
        />
        <Stat
          label="Benchmark cost"
          value={usd(cost.total_benchmark)}
          accent="text-graphite"
          sub="market reference"
        />
      </div>

      {/* model routing */}
      <div className="mt-5 pt-5 border-t border-line">
        <div className="text-[11px] uppercase tracking-[0.08em] text-stone mb-2.5">
          Model routing
        </div>
        <div className="grid sm:grid-cols-3 gap-2.5">
          {perStage.map((s) => (
            <div
              key={s.key}
              className="rounded-inner bg-fog px-3.5 py-2.5 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="text-[12px] text-stone">{s.label}</div>
                <div className="text-[13px] font-medium text-carbon truncate">{s.model}</div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <div className="text-[12px] text-graphite tabular-nums">{s.calls}×</div>
                <div className="text-[10px] text-pebble tabular-nums">{usd(s.charge)}</div>
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
  sub,
}: {
  label: string;
  value: string;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="rounded-inner bg-fog px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-[0.06em] text-stone">{label}</div>
      <div className={`text-[22px] font-medium mt-1 tabular-nums ${accent}`}>{value}</div>
      {sub && <div className="text-[10px] text-pebble mt-0.5">{sub}</div>}
    </div>
  );
}
