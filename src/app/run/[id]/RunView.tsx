"use client";

import { useEffect, useRef, useState } from "react";
import type { Run, RunEvent, TestCase, ApiTest } from "@/lib/types";
import CostPanel from "@/components/CostPanel";
import TestCard from "@/components/TestCard";
import ApiTestCard from "@/components/ApiTestCard";
import EventLog from "@/components/EventLog";

export default function RunView({ id }: { id: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [log, setLog] = useState<RunEvent[]>([]);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchRun() {
    try {
      const r = await fetch(`/api/runs/${id}`, { cache: "no-store" });
      const d = await r.json();
      if (d.run) setRun(d.run);
    } catch {
      /* ignore */
    }
  }

  function scheduleRefetch() {
    if (refetchTimer.current) return;
    refetchTimer.current = setTimeout(() => {
      refetchTimer.current = null;
      fetchRun();
    }, 500);
  }

  useEffect(() => {
    fetchRun();
    const es = new EventSource(`/api/runs/${id}/stream`);
    es.onmessage = (msg) => {
      try {
        const e: RunEvent = JSON.parse(msg.data);
        setLog((prev) => [...prev, e]);
        scheduleRefetch();
        if (e.type === "done" || e.type === "error") {
          es.close();
          setTimeout(fetchRun, 300);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es.close();
      setTimeout(fetchRun, 300);
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!run)
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 shimmer rounded-sm" />
        <div className="h-32 shimmer rounded-card" />
      </div>
    );

  const active = !["done", "error"].includes(run.status);
  const isApi = run.mode === "api";
  const items = isApi ? run.apiTests || [] : run.tests || [];
  const passed = items.filter((t) => t.status === "passed").length;
  const failed = items.filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-6 animate-rise">
      {/* header */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="min-w-0">
          <a href="/" className="text-[13px] text-stone hover:text-carbon transition">← all runs</a>
          <h1 className="font-display text-carbon text-[clamp(26px,4vw,40px)] leading-[1.15] truncate mt-1.5">
            {run.url}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 text-[14px]">
            <span className="px-2 py-0.5 rounded-badge bg-fog text-graphite text-[11px] font-medium uppercase tracking-[0.06em]">
              {isApi ? "API" : "Web UI"}
            </span>
            <StatusBadge status={run.status} />
            {items.length > 0 && (
              <span className="text-stone">
                <span className="text-pass font-medium">{passed} passed</span> ·{" "}
                <span className="text-fail font-medium">{failed} failed</span> · {items.length} total
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <ModelTag label="plan" model={run.models.planner} />
          {!isApi && <ModelTag label="act" model={run.models.agent} />}
          <ModelTag label="analyze" model={run.models.analyst} />
        </div>
      </div>

      {run.error && (
        <div className="rounded-inner border-l-2 border-fail bg-fail/[.06] p-4 text-[13px] text-fail">
          {run.error}
        </div>
      )}

      <CostPanel cost={run.cost} models={run.models} />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-3 order-2 lg:order-1">
          {items.length === 0 ? (
            <div className="rounded-card bg-snow shadow-subtle p-6 text-[14px] text-stone flex items-center gap-3">
              <span className="w-4 h-4 rounded-full border-2 border-graphite border-t-transparent animate-spin-slow" />
              {active
                ? isApi
                  ? "Discovering endpoints and generating an API test plan…"
                  : "Exploring the app and generating a test plan…"
                : "No tests were generated."}
            </div>
          ) : isApi ? (
            (items as ApiTest[]).map((t) => <ApiTestCard key={t.id} test={t} />)
          ) : (
            (items as TestCase[]).map((t) => <TestCard key={t.id} test={t} />)
          )}
        </div>

        <div className="order-1 lg:order-2 lg:sticky lg:top-24">
          <EventLog events={log.length ? log : run.events} active={active} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "text-pass border-pass/30 bg-pass/[.08]",
    error: "text-fail border-fail/30 bg-fail/[.08]",
    running: "text-carbon border-line2/60 bg-fog",
    planning: "text-warn border-warn/30 bg-warn/[.08]",
    analyzing: "text-warn border-warn/30 bg-warn/[.08]",
    queued: "text-stone border-line bg-fog",
  };
  const active = !["done", "error"].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-badge border text-[12px] font-medium ${map[status] || map.queued}`}
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />}
      {status}
    </span>
  );
}

function ModelTag({ label, model }: { label: string; model: string }) {
  return (
    <span className="px-2.5 py-1 rounded-badge bg-snow shadow-subtle text-graphite">
      <span className="text-pebble">{label}:</span> <span className="text-carbon font-medium">{model}</span>
    </span>
  );
}
