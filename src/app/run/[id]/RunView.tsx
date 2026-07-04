"use client";

import { useEffect, useRef, useState } from "react";
import type { Run, RunEvent, TestCase } from "@/lib/types";
import CostPanel from "@/components/CostPanel";
import TestCard from "@/components/TestCard";
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
      // stream ended; do a final fetch
      es.close();
      setTimeout(fetchRun, 300);
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!run)
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 shimmer rounded-lg" />
        <div className="h-32 shimmer rounded-xl" />
      </div>
    );

  const active = !["done", "error"].includes(run.status);
  const passed = run.tests.filter((t) => t.status === "passed").length;
  const failed = run.tests.filter((t) => t.status === "failed").length;

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="min-w-0">
          <a href="/" className="text-xs text-mut hover:text-fg">← all runs</a>
          <h1 className="text-2xl font-bold tracking-tight truncate mt-1">{run.url}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <StatusBadge status={run.status} />
            {run.tests.length > 0 && (
              <span className="text-mut">
                <span className="text-ok">{passed} passed</span> ·{" "}
                <span className="text-bad">{failed} failed</span> · {run.tests.length} total
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 text-[11px] font-mono">
          <ModelTag label="plan" model={run.models.planner} />
          <ModelTag label="act" model={run.models.agent} />
          <ModelTag label="analyze" model={run.models.analyst} />
        </div>
      </div>

      {run.error && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          {run.error}
        </div>
      )}

      <CostPanel cost={run.cost} models={run.models} />

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* tests */}
        <div className="space-y-3 order-2 lg:order-1">
          {run.tests.length === 0 ? (
            <div className="rounded-xl border border-line bg-panel/50 p-6 text-sm text-mut flex items-center gap-3">
              <span className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin-slow" />
              {active ? "Exploring the app and generating a test plan…" : "No tests were generated."}
            </div>
          ) : (
            run.tests.map((t: TestCase, i) => <TestCard key={t.id} test={t} index={i} />)
          )}
        </div>

        {/* live log */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-20">
          <EventLog events={log.length ? log : run.events} active={active} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "text-ok border-ok/30 bg-ok/10",
    error: "text-bad border-bad/30 bg-bad/10",
    running: "text-brand2 border-brand2/30 bg-brand2/10",
    planning: "text-warn border-warn/30 bg-warn/10",
    analyzing: "text-warn border-warn/30 bg-warn/10",
    queued: "text-mut border-line bg-panel",
  };
  const active = !["done", "error"].includes(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${map[status] || map.queued}`}
    >
      {active && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />}
      {status}
    </span>
  );
}

function ModelTag({ label, model }: { label: string; model: string }) {
  return (
    <span className="px-2 py-1 rounded-md border border-line bg-panel">
      <span className="text-mut">{label}:</span>{" "}
      <span className="text-brand2">{model}</span>
    </span>
  );
}
