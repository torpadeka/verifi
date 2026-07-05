// Failure analysis for API tests. Hands the model the failing call's request,
// response, and failed assertions and asks for a structured, developer-ready bug
// report.

import { chat, parseJson } from "../btl";
import { MODELS } from "../models";
import type { ApiTest, BugReport, CostLedger } from "../types";

export async function analyzeApiFailure(test: ApiTest, ledger: CostLedger): Promise<BugReport> {
  const failIdx = test.calls.findIndex((c) => c.status === "fail");
  const idx = failIdx >= 0 ? failIdx : test.calls.length - 1;
  const call = test.calls[idx];

  const reqStr = call
    ? `${call.request.method} ${call.request.url}\n${call.request.body ? `body: ${call.request.body.slice(0, 800)}` : "(no body)"}`
    : "(no request)";
  const resStr = call?.response
    ? `HTTP ${call.response.status} ${call.response.statusText} (${call.response.latencyMs}ms)\nbody: ${call.response.body.slice(0, 1000)}`
    : `no response — ${call?.note || "request failed"}`;
  const failedChecks = (call?.checks || [])
    .filter((c) => !c.passed)
    .map((c) => `- ${c.name}${c.detail ? ` (${c.detail})` : ""}`)
    .join("\n");

  const sys = `You are an API QA failure analyst. Given a failed API test — the request, the response, and the failed assertions — produce a crisp, developer-ready bug report. Base the root cause only on the evidence. Distinguish a genuine server bug from a test-expectation mismatch when possible.`;

  const userText = `TEST: ${test.title}
ENDPOINT: ${test.endpoint}
INTENT: ${test.intent}

FAILING CALL: ${call?.label || "(unknown)"}
REQUEST:
${reqStr}

RESPONSE:
${resStr}

FAILED ASSERTIONS:
${failedChecks || "(none — network/timeout)"}

Return ONLY JSON:
{"severity":"critical|major|minor","title":"one-line bug title","summary":"what went wrong","root_cause":"most likely cause","suggested_fix":"concrete fix","failing_step":${idx + 1}}`;

  try {
    const { content } = await chat({
      model: MODELS.analyst,
      stage: "analyze",
      ledger,
      json: true,
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userText },
      ],
    });
    const p = parseJson<any>(content);
    return {
      severity: p.severity || "major",
      title: p.title || test.title,
      summary: p.summary || "",
      root_cause: p.root_cause || "",
      suggested_fix: p.suggested_fix || "",
      failing_step: p.failing_step || idx + 1,
    };
  } catch (err: any) {
    return {
      severity: "major",
      title: test.title,
      summary: test.verdict || "API test failed.",
      root_cause: `Analysis unavailable: ${String(err.message).slice(0, 120)}`,
      suggested_fix: "Inspect the failing call's request and response.",
      failing_step: idx + 1,
    };
  }
}
