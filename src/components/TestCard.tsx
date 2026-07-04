"use client";

import { useState } from "react";
import type { TestCase } from "@/lib/types";

const statusStyle: Record<string, { ring: string; text: string; icon: string }> = {
  passed: { ring: "border-ok/40", text: "text-ok", icon: "✓" },
  failed: { ring: "border-bad/40", text: "text-bad", icon: "✗" },
  running: { ring: "border-brand2/50", text: "text-brand2", icon: "●" },
  pending: { ring: "border-line", text: "text-mut", icon: "○" },
  blocked: { ring: "border-warn/40", text: "text-warn", icon: "!" },
};

const sevStyle: Record<string, string> = {
  critical: "text-bad border-bad/40 bg-bad/10",
  major: "text-warn border-warn/40 bg-warn/10",
  minor: "text-mut border-line bg-panel",
};

export default function TestCard({ test, index }: { test: TestCase; index: number }) {
  const [open, setOpen] = useState(test.status === "failed");
  const s = statusStyle[test.status] || statusStyle.pending;
  const running = test.status === "running";

  return (
    <div className={`rounded-xl border ${s.ring} bg-panel/60 overflow-hidden transition`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-panel2/50 transition"
      >
        <span
          className={`grid place-items-center w-6 h-6 rounded-full border ${s.ring} ${s.text} text-xs font-bold ${running ? "animate-pulse-dot" : ""}`}
        >
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[15px] truncate">{test.title}</div>
          <div className="text-[11px] text-mut flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-ink border border-line">{test.category}</span>
            <span className={test.priority === "high" ? "text-warn" : ""}>{test.priority}</span>
            {test.steps.length > 0 && <span>· {test.steps.length} steps</span>}
          </div>
        </div>
        {test.bug && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sevStyle[test.bug.severity]}`}>
            {test.bug.severity}
          </span>
        )}
        <span className="text-mut text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-line/50 pt-3">
          <div className="text-xs text-mut">
            <span className="text-fg/80 font-medium">Expected:</span> {test.expected}
          </div>

          {/* bug report first if present */}
          {test.bug && (
            <div className="rounded-lg border border-bad/30 bg-bad/[.06] p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span>🐞</span>
                <span className="font-semibold text-bad text-sm">{test.bug.title}</span>
              </div>
              <Field label="Summary" value={test.bug.summary} />
              <Field label="Root cause" value={test.bug.root_cause} />
              <Field label="Suggested fix" value={test.bug.suggested_fix} highlight />
              {test.bug.evidence_screenshot && (
                <a href={test.bug.evidence_screenshot} target="_blank" rel="noreferrer">
                  <img
                    src={test.bug.evidence_screenshot}
                    alt="evidence"
                    className="mt-2 rounded-lg border border-bad/30 w-full hover:opacity-90 transition"
                  />
                </a>
              )}
            </div>
          )}

          {test.verdict && !test.bug && (
            <div className="text-xs text-ok/90 bg-ok/[.06] border border-ok/20 rounded-lg px-3 py-2">
              {test.verdict}
            </div>
          )}

          {/* steps */}
          <div className="space-y-2">
            {test.steps.map((step) => (
              <div key={step.index} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span
                    className={`w-2 h-2 rounded-full ${step.status === "fail" ? "bg-bad" : "bg-brand2"}`}
                  />
                  <span className="flex-1 w-px bg-line mt-1" />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="text-[13px]">
                    <span className="font-mono text-brand2">{step.action.kind}</span>
                    {step.action.selector && (
                      <span className="font-mono text-mut"> {step.action.selector}</span>
                    )}
                    {step.action.value && (
                      <span className="text-mut"> “{step.action.value}”</span>
                    )}
                  </div>
                  {step.thought && (
                    <div className="text-[11px] text-mut italic mt-0.5">{step.thought}</div>
                  )}
                  <div
                    className={`text-[11px] mt-0.5 ${step.status === "fail" ? "text-bad" : "text-mut/80"}`}
                  >
                    → {step.note}
                  </div>
                  {step.screenshot && (
                    <a href={step.screenshot} target="_blank" rel="noreferrer">
                      <img
                        src={step.screenshot}
                        alt={`step ${step.index}`}
                        loading="lazy"
                        className="mt-1.5 rounded-md border border-line w-full max-w-md hover:border-brand/50 transition"
                      />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 text-xs text-brand2 pl-5">
                <span className="w-3 h-3 rounded-full border-2 border-brand2 border-t-transparent animate-spin-slow" />
                thinking…
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
    <div className="text-xs">
      <span className="text-mut">{label}: </span>
      <span className={highlight ? "text-ok/90" : "text-fg/85"}>{value}</span>
    </div>
  );
}
