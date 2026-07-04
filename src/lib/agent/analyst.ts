// Failure analysis. For a failed test, hand the model the full step trace plus
// the final screenshot and ask for a structured, actionable bug report.

import { chat, parseJson } from "../btl";
import { MODELS } from "../models";
import type { BugReport, CostLedger, TestCase } from "../types";
import type { BrowserAgent } from "./browser";

export async function analyzeFailure(
  test: TestCase,
  browser: BrowserAgent,
  ledger: CostLedger
): Promise<BugReport> {
  const failingStep = test.steps.findIndex((s) => s.status === "fail");
  const idx = failingStep >= 0 ? failingStep : test.steps.length - 1;
  const evidence = test.steps[idx]?.screenshot;
  const imgData = evidence ? await browser.dataUrlOf(evidence) : null;

  const trace = test.steps
    .map(
      (s) =>
        `#${s.index + 1} [${s.status}] ${s.action.kind}${s.action.selector ? " " + s.action.selector : ""}${s.action.value ? ` "${s.action.value}"` : ""} — ${s.thought} => ${s.note}`
    )
    .join("\n");

  const sys = `You are a QA failure analyst. Given a failed browser test, produce a crisp, developer-ready bug report. Base the root cause only on the evidence. Console errors and failed network requests are strong root-cause signals — weigh them heavily. Be specific and practical.`;

  const diag = test.diagnostics;
  const diagText =
    diag && (diag.console.length || diag.network.length)
      ? `\nCONSOLE ERRORS DURING TEST:\n${diag.console.join("\n") || "(none)"}\nFAILED NETWORK REQUESTS DURING TEST:\n${diag.network.join("\n") || "(none)"}\n`
      : "";

  const userText = `TEST: ${test.title}
EXPECTED: ${test.expected}
FINAL VERDICT FROM AGENT: ${test.verdict || "(none)"}

STEP TRACE:
${trace}
${diagText}
Return ONLY JSON:
{"severity":"critical|major|minor","title":"one-line bug title","summary":"what went wrong from the user's perspective","root_cause":"most likely technical cause","suggested_fix":"concrete fix a developer can act on","failing_step":${idx + 1}}`;

  const content: any[] = [{ type: "text", text: userText }];
  if (imgData) content.push({ type: "image_url", image_url: { url: imgData } });

  let report: BugReport;
  try {
    const { content: out } = await chat({
      model: MODELS.analyst,
      stage: "analyze",
      ledger,
      json: true,
      temperature: 0.2,
      // Reasoning models (e.g. gpt-5-mini) spend completion tokens thinking before
      // emitting the JSON, so give the analyst plenty of headroom or it truncates.
      max_tokens: 2000,
      messages: [
        { role: "system", content: sys },
        { role: "user", content },
      ],
    });
    const p = parseJson<any>(out);
    report = {
      severity: p.severity || "major",
      title: p.title || test.title,
      summary: p.summary || "",
      root_cause: p.root_cause || "",
      suggested_fix: p.suggested_fix || "",
      failing_step: p.failing_step || idx + 1,
      evidence_screenshot: evidence,
    };
  } catch (err: any) {
    report = {
      severity: "major",
      title: test.title,
      summary: test.verdict || "Test failed.",
      root_cause: `Analysis unavailable: ${String(err.message).slice(0, 120)}`,
      suggested_fix: "Re-run the test and inspect the failing step screenshot.",
      failing_step: idx + 1,
      evidence_screenshot: evidence,
    };
  }
  return report;
}
