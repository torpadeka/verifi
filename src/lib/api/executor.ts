// API test executor. Runs a planned test's call chain against the live server:
// interpolate variables -> send -> validate assertions -> extract variables for
// the next call. Fully deterministic; makes zero LLM calls (only plan + analyze
// hit the runtime), which is why API runs are dramatically cheaper than UI runs.

import { readPath, sendRequest, type Vars } from "./http";
import type { PlannedApiTest, PlannedCheck } from "./planner";
import type { ApiCall, ApiCheck, ApiConfig, ApiTest, HttpResponse } from "../types";

function typeOf(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v;
}

function evalChecks(check: PlannedCheck, res: HttpResponse | null, err?: string): ApiCheck[] {
  const out: ApiCheck[] = [];
  if (!res) {
    out.push({ name: "request completed", passed: false, detail: err || "no response" });
    return out;
  }

  if (check.status && check.status.length) {
    const ok = check.status.includes(res.status);
    out.push({
      name: `status ∈ [${check.status.join(", ")}]`,
      passed: ok,
      detail: `got ${res.status}`,
    });
  }

  for (const key of check.json_has || []) {
    const v = readPath(res.json, key);
    out.push({
      name: `body has "${key}"`,
      passed: v !== undefined,
      detail: v === undefined ? "missing" : undefined,
    });
  }

  for (const a of check.asserts || []) {
    const v = readPath(res.json, a.path);
    let passed = false;
    let detail = "";
    switch (a.op) {
      case "exists":
        passed = v !== undefined && v !== null;
        break;
      case "equals":
        passed =
          typeof a.value === "object"
            ? JSON.stringify(v) === JSON.stringify(a.value)
            : v === a.value || String(v) === String(a.value);
        detail = `got ${JSON.stringify(v)?.slice(0, 60)}`;
        break;
      case "contains":
        passed = Array.isArray(v)
          ? v.map(String).includes(String(a.value))
          : typeof v === "string"
            ? v.includes(String(a.value))
            : v && typeof v === "object"
              ? String(a.value) in (v as object)
              : false;
        break;
      case "type":
        passed = typeOf(v) === String(a.value);
        detail = `got ${typeOf(v)}`;
        break;
      case "gt":
        passed = Number(v) > Number(a.value);
        detail = `got ${v}`;
        break;
      case "lt":
        passed = Number(v) < Number(a.value);
        detail = `got ${v}`;
        break;
    }
    out.push({ name: `${a.path} ${a.op}${a.value !== undefined ? " " + JSON.stringify(a.value) : ""}`, passed, detail: detail || undefined });
  }

  if (check.max_latency_ms) {
    out.push({
      name: `latency < ${check.max_latency_ms}ms`,
      passed: res.latencyMs <= check.max_latency_ms,
      detail: `${res.latencyMs}ms`,
    });
  }

  if (out.length === 0) {
    // no explicit checks — default to "did not 5xx"
    out.push({ name: "no server error", passed: res.status < 500, detail: `status ${res.status}` });
  }
  return out;
}

export async function runApiTest(
  planned: PlannedApiTest,
  id: string,
  api: ApiConfig,
  onCall: (call: ApiCall) => void
): Promise<ApiTest> {
  const test: ApiTest = {
    id,
    title: planned.title || "API test",
    category: planned.category || "happy",
    priority: planned.priority || "medium",
    endpoint: planned.endpoint || "",
    intent: planned.intent || "",
    status: "running",
    calls: [],
    startedAt: Date.now(),
  };

  const vars: Vars = {};
  let totalLatency = 0;
  let failed = false;

  for (let i = 0; i < planned.calls.length; i++) {
    const pc = planned.calls[i];
    const { request, response, error } = await sendRequest(
      { method: pc.method, path: pc.path, headers: pc.headers, body: pc.body, query: pc.query },
      api.baseUrl,
      api.auth,
      vars
    );

    const checks = evalChecks(pc.expect || {}, response, error);
    const callFailed = !response || checks.some((c) => !c.passed);
    if (response) totalLatency += response.latencyMs;

    // extract variables for subsequent calls
    if (response && pc.extract) {
      for (const [name, path] of Object.entries(pc.extract)) {
        const val = readPath(response.json, path);
        if (val !== undefined && val !== null) vars[name] = typeof val === "string" ? val : JSON.stringify(val);
      }
    }

    const call: ApiCall = {
      index: i,
      label: pc.label || `${pc.method} ${pc.path}`,
      request,
      response: response || undefined,
      checks,
      status: callFailed ? "fail" : "ok",
      note: error,
      ts: Date.now(),
    };
    test.calls.push(call);
    onCall(call);

    if (callFailed) {
      failed = true;
      break; // chain can't continue reliably once a call fails
    }
  }

  test.latencyMs = totalLatency;
  test.status = failed ? "failed" : "passed";
  const passedChecks = test.calls.flatMap((c) => c.checks).filter((c) => c.passed).length;
  const totalChecks = test.calls.flatMap((c) => c.checks).length;
  test.verdict = failed
    ? `${passedChecks}/${totalChecks} assertions passed — see failing call.`
    : `All ${totalChecks} assertions passed across ${test.calls.length} call(s).`;
  test.finishedAt = Date.now();
  return test;
}
