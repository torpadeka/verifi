"use client";

import { useState } from "react";
import type { TestCase } from "@/lib/types";

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

export default function TestCard({ test }: { test: TestCase; index?: number }) {
  const [open, setOpen] = useState(test.status === "failed");
  const s = statusStyle[test.status] || statusStyle.pending;
  const running = test.status === "running";

  return (
    <div className="rounded-card bg-snow shadow-subtle overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-fog/60 transition"
      >
        <span
          className={`grid place-items-center w-6 h-6 rounded-full border ${s.ring} ${s.text} text-[11px] font-semibold ${running ? "animate-pulse-dot" : ""}`}
        >
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[15px] text-carbon truncate">{test.title}</div>
          <div className="text-[12px] text-stone flex items-center gap-2 mt-0.5">
            <span className="px-2 py-0.5 rounded-badge bg-fog text-graphite">{test.category}</span>
            <span className={test.priority === "high" ? "text-warn" : ""}>{test.priority}</span>
            {test.steps.length > 0 && <span className="text-pebble">· {test.steps.length} steps</span>}
          </div>
        </div>
        {test.bug && (
          <span className={`text-[11px] px-2.5 py-0.5 rounded-badge border ${sevStyle[test.bug.severity]}`}>
            {test.bug.severity}
          </span>
        )}
        <span className="text-pebble text-[11px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3.5 border-t border-line pt-4">
          <div className="text-[13px] text-stone">
            <span className="text-graphite font-medium">Expected:</span> {test.expected}
          </div>

          {/* bug report */}
          {test.bug && (
            <div className="rounded-inner bg-fog border-l-2 border-fail p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span>🐞</span>
                <span className="font-medium text-fail text-[14px]">{test.bug.title}</span>
              </div>
              <Field label="Summary" value={test.bug.summary} />
              <Field label="Root cause" value={test.bug.root_cause} />
              <Field label="Suggested fix" value={test.bug.suggested_fix} highlight />
              {test.bug.evidence_screenshot && (
                <a href={test.bug.evidence_screenshot} target="_blank" rel="noreferrer">
                  <img
                    src={test.bug.evidence_screenshot}
                    alt="evidence"
                    className="mt-2 rounded-sm border border-line2/50 w-full hover:opacity-95 transition"
                  />
                </a>
              )}
            </div>
          )}

          {test.verdict && !test.bug && (
            <div className="text-[13px] text-pass bg-pass/[.06] border-l-2 border-pass rounded-inner px-4 py-2.5">
              {test.verdict}
            </div>
          )}

          {/* steps timeline */}
          <div className="space-y-2.5">
            {test.steps.map((step) => (
              <div key={step.index} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className={`w-2 h-2 rounded-full ${step.status === "fail" ? "bg-fail" : "bg-graphite"}`} />
                  <span className="flex-1 w-px bg-line mt-1" />
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <div className="text-[13px]">
                    <span className="font-medium text-carbon">{step.action.kind}</span>
                    {step.action.selector && (
                      <span className="text-pebble"> {step.action.selector}</span>
                    )}
                    {step.action.value && <span className="text-stone"> “{step.action.value}”</span>}
                  </div>
                  {step.thought && (
                    <div className="text-[12px] text-stone italic mt-0.5">{step.thought}</div>
                  )}
                  <div className={`text-[12px] mt-0.5 ${step.status === "fail" ? "text-fail" : "text-pebble"}`}>
                    → {step.note}
                  </div>
                  {step.screenshot && (
                    <a href={step.screenshot} target="_blank" rel="noreferrer">
                      <img
                        src={step.screenshot}
                        alt={`step ${step.index}`}
                        loading="lazy"
                        className="mt-2 rounded-sm border border-line2/50 w-full max-w-md hover:border-carbon/40 transition"
                      />
                    </a>
                  )}
                </div>
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-2 text-[12px] text-stone pl-5">
                <span className="w-3 h-3 rounded-full border-2 border-graphite border-t-transparent animate-spin-slow" />
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
    <div className="text-[13px] leading-[1.5]">
      <span className="text-stone">{label}: </span>
      <span className={highlight ? "text-pass font-medium" : "text-ink"}>{value}</span>
    </div>
  );
}
