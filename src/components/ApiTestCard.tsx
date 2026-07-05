"use client";

import { useState } from "react";
import type { ApiTest } from "@/lib/types";

const statusStyle: Record<string, { text: string; icon: string; ring: string }> = {
  passed: { text: "text-pass", icon: "✓", ring: "border-pass/40" },
  failed: { text: "text-fail", icon: "✗", ring: "border-fail/40" },
  running: { text: "text-carbon", icon: "●", ring: "border-line2/60" },
  pending: { text: "text-pebble", icon: "○", ring: "border-line" },
  blocked: { text: "text-warn", icon: "!", ring: "border-warn/40" },
};

const sevStyle: Record<string, string> = {
  critical: "text-fail border-fail/40 bg-fail/[.06]",
  major: "text-warn border-warn/40 bg-warn/[.06]",
  minor: "text-stone border-line2/60 bg-fog",
};

const methodColor: Record<string, string> = {
  GET: "text-pass",
  POST: "text-warn",
  PUT: "text-warn",
  PATCH: "text-warn",
  DELETE: "text-fail",
};

export default function ApiTestCard({ test }: { test: ApiTest }) {
  const [open, setOpen] = useState(test.status === "failed");
  const s = statusStyle[test.status] || statusStyle.pending;
  const running = test.status === "running";
  const checksPassed = test.calls.flatMap((c) => c.checks).filter((c) => c.passed).length;
  const checksTotal = test.calls.flatMap((c) => c.checks).length;

  return (
    <div className="rounded-card bg-snow shadow-subtle overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-fog/60 transition">
        <span className={`grid place-items-center w-6 h-6 rounded-full border ${s.ring} ${s.text} text-[11px] font-semibold ${running ? "animate-pulse-dot" : ""}`}>
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[15px] text-carbon truncate">{test.title}</div>
          <div className="text-[12px] text-stone flex items-center gap-2 mt-0.5">
            <span className="font-mono text-graphite">{test.endpoint}</span>
            <span className="px-2 py-0.5 rounded-badge bg-fog text-graphite">{test.category}</span>
            {checksTotal > 0 && (
              <span className={checksPassed === checksTotal ? "text-pass" : "text-fail"}>
                {checksPassed}/{checksTotal} checks
              </span>
            )}
            {test.latencyMs != null && test.calls.length > 0 && <span className="text-pebble">· {test.latencyMs}ms</span>}
          </div>
        </div>
        {test.bug && <span className={`text-[11px] px-2.5 py-0.5 rounded-badge border ${sevStyle[test.bug.severity]}`}>{test.bug.severity}</span>}
        <span className="text-pebble text-[11px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3.5 border-t border-line pt-4">
          <div className="text-[13px] text-stone">
            <span className="text-graphite font-medium">Intent:</span> {test.intent}
          </div>

          {test.bug && (
            <div className="rounded-inner bg-fog border-l-2 border-fail p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span>🐞</span>
                <span className="font-medium text-fail text-[14px]">{test.bug.title}</span>
              </div>
              <Field label="Summary" value={test.bug.summary} />
              <Field label="Root cause" value={test.bug.root_cause} />
              <Field label="Suggested fix" value={test.bug.suggested_fix} highlight />
            </div>
          )}

          {test.verdict && !test.bug && (
            <div className="text-[13px] text-pass bg-pass/[.06] border-l-2 border-pass rounded-inner px-4 py-2.5">{test.verdict}</div>
          )}

          {/* call chain */}
          <div className="space-y-3">
            {test.calls.map((c) => (
              <div key={c.index} className="rounded-inner border border-line overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2 bg-fog/70">
                  <span className={`font-mono text-[12px] font-semibold ${methodColor[c.request.method] || "text-graphite"}`}>{c.request.method}</span>
                  <span className="font-mono text-[12px] text-graphite truncate flex-1">{c.request.url}</span>
                  {c.response ? (
                    <span className={`font-mono text-[12px] ${c.response.status < 400 ? "text-pass" : "text-fail"}`}>{c.response.status}</span>
                  ) : (
                    <span className="font-mono text-[12px] text-fail">ERR</span>
                  )}
                  {c.response && <span className="text-[11px] text-pebble tabular-nums">{c.response.latencyMs}ms</span>}
                </div>
                <div className="px-3.5 py-2.5 space-y-1">
                  <div className="text-[12px] text-stone">{c.label}</div>
                  {c.checks.map((ch, i) => (
                    <div key={i} className={`text-[12px] font-mono flex gap-1.5 ${ch.passed ? "text-graphite" : "text-fail"}`}>
                      <span>{ch.passed ? "✓" : "✗"}</span>
                      <span>{ch.name}{ch.detail ? ` — ${ch.detail}` : ""}</span>
                    </div>
                  ))}
                  {c.note && <div className="text-[12px] text-fail">{c.note}</div>}
                  {c.response?.body && (
                    <details className="mt-1">
                      <summary className="text-[11px] text-pebble cursor-pointer hover:text-stone">response body</summary>
                      <pre className="mt-1 text-[11px] font-mono text-graphite bg-fog rounded-sm p-2 overflow-x-auto max-h-52 whitespace-pre-wrap break-all">{c.response.body}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 text-[12px] text-stone pl-1">
                <span className="w-3 h-3 rounded-full border-2 border-graphite border-t-transparent animate-spin-slow" />
                sending…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-[13px] leading-[1.5]">
      <span className="text-stone">{label}: </span>
      <span className={highlight ? "text-pass font-medium" : "text-ink"}>{value}</span>
    </div>
  );
}
