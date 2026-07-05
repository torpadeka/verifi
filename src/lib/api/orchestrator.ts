// API-mode pipeline: (optionally) load an OpenAPI spec -> plan API tests ->
// execute each call chain with assertions -> analyze failures -> summarize.
// Emits the same streaming events as the UI pipeline so the live view is shared.

import { emit, putRun } from "../store";
import { MODELS } from "../models";
import type { ApiTest, Run } from "../types";
import { loadSpec, summarizeSpec, endpointsToPrompt } from "./openapi";
import { planApiTests } from "./planner";
import { runApiTest } from "./executor";
import { analyzeApiFailure } from "./analyst";

function costSnapshot(run: Run) {
  const c = run.cost;
  return {
    total_benchmark: c.total_benchmark,
    total_charge: c.total_charge,
    total_saved: c.total_saved,
    cache_hits: c.cache_hits,
    calls: c.calls,
    by_model: c.by_model,
  };
}

export async function executeApiRun(run: Run) {
  try {
    const api = run.api!;
    run.status = "planning";

    // 1. discover endpoints from a spec if one was supplied
    let endpointList: string | undefined;
    if (api.specUrl) {
      emit(run, { t: Date.now(), type: "status", message: "Loading OpenAPI spec…" });
      try {
        const spec = await loadSpec(api.specUrl);
        const sum = summarizeSpec(spec, api.specUrl.startsWith("http") ? api.specUrl : undefined);
        if (!api.baseUrl && sum.baseUrl) api.baseUrl = sum.baseUrl;
        endpointList = endpointsToPrompt(sum.endpoints);
        emit(run, {
          t: Date.now(),
          type: "log",
          message: `Parsed spec "${sum.title || "API"}" — ${sum.endpoints.length} endpoints · base ${api.baseUrl}`,
        });
      } catch (e: any) {
        emit(run, {
          t: Date.now(),
          type: "log",
          message: `Spec load failed (${String(e.message).slice(0, 80)}); planning from description instead.`,
        });
      }
    }

    if (!api.baseUrl) throw new Error("No base URL — provide one or a spec with a server URL.");

    // 2. plan
    emit(run, {
      t: Date.now(),
      type: "status",
      message: `Generating API test plan with ${MODELS.planner}…`,
    });
    const planned = await planApiTests(api, endpointList, run.maxTests, run.cost);
    // seed placeholder tests so the UI shows the plan immediately
    run.apiTests = planned.map((p, i) => ({
      id: `a${i + 1}`,
      title: p.title,
      category: p.category,
      priority: p.priority,
      endpoint: p.endpoint,
      intent: p.intent,
      status: "pending" as const,
      calls: [],
    }));
    emit(run, {
      t: Date.now(),
      type: "plan",
      message: `Planned ${planned.length} API test cases`,
      data: run.apiTests.map((t) => ({ id: t.id, title: t.title, category: t.category, priority: t.priority, endpoint: t.endpoint })),
    });
    emit(run, { t: Date.now(), type: "cost", data: costSnapshot(run) });
    putRun(run);

    // 3. execute
    run.status = "running";
    for (let i = 0; i < planned.length; i++) {
      const id = `a${i + 1}`;
      const stub = run.apiTests[i];
      stub.status = "running";
      emit(run, { t: Date.now(), type: "test_start", message: `▶ ${stub.title}`, data: { id } });

      const result: ApiTest = await runApiTest(planned[i], id, api, (call) => {
        // stream each call onto the placeholder as it completes
        stub.calls.push(call);
        emit(run, {
          t: Date.now(),
          type: "step",
          message: `${id} · ${call.request.method} ${call.request.url.replace(api.baseUrl, "") || "/"} → ${call.response ? call.response.status : "ERR"} ${call.status === "fail" ? "✗" : "✓"}`,
          data: { testId: id, call },
        });
      });
      run.apiTests[i] = result;

      if (result.status === "failed") {
        run.status = "analyzing";
        emit(run, { t: Date.now(), type: "status", message: `Analyzing failure with ${MODELS.analyst}…` });
        result.bug = await analyzeApiFailure(result, run.cost);
        emit(run, {
          t: Date.now(),
          type: "bug",
          message: `🐞 ${result.bug.severity.toUpperCase()}: ${result.bug.title}`,
          data: { testId: id, bug: result.bug },
        });
        run.status = "running";
      }

      emit(run, {
        t: Date.now(),
        type: "test_end",
        message: `${result.status === "passed" ? "✓" : "✗"} ${result.title} (${result.latencyMs}ms)`,
        data: { id, status: result.status },
      });
      emit(run, { t: Date.now(), type: "cost", data: costSnapshot(run) });
      putRun(run);
    }

    const passed = run.apiTests.filter((t) => t.status === "passed").length;
    const failed = run.apiTests.filter((t) => t.status === "failed").length;
    run.summary = `${passed}/${run.apiTests.length} passed · ${failed} failed`;
    run.status = "done";
    run.finishedAt = Date.now();
    emit(run, { t: Date.now(), type: "done", message: `Run complete — ${run.summary}`, data: { passed, failed, cost: costSnapshot(run) } });
    putRun(run);
  } catch (err: any) {
    run.status = "error";
    run.error = String(err?.message || err);
    run.finishedAt = Date.now();
    emit(run, { t: Date.now(), type: "error", message: run.error });
    putRun(run);
  }
}
