// Orchestrates a full QA run: launch browser -> plan tests -> execute each ->
// analyze failures -> summarize. Emits streaming events the whole way so the UI
// can render progress live. Runs detached (fire-and-forget) from the API route.

import { emit, putRun } from "../store";
import { chat } from "../btl";
import { MODELS } from "../models";
import type { Run } from "../types";
import { BrowserAgent } from "./browser";
import { planTests } from "./planner";
import { runTest } from "./executor";
import { analyzeFailure } from "./analyst";
import { executeApiRun } from "../api/orchestrator";

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

export async function executeRun(run: Run) {
  if (run.mode === "api") {
    await executeApiRun(run);
    return;
  }
  const browser = new BrowserAgent(run.id);
  try {
    run.status = "planning";
    emit(run, { t: Date.now(), type: "status", message: "Launching browser…" });
    await browser.start();

    emit(run, { t: Date.now(), type: "log", message: `Loading ${run.url}` });
    await browser.goto(run.url);

    const landing = await browser.snapshot("landing");
    emit(run, {
      t: Date.now(),
      type: "log",
      message: `Mapped landing page: "${landing.title}" — ${landing.elements.length} interactive elements`,
    });

    emit(run, {
      t: Date.now(),
      type: "status",
      message: `Generating test plan with ${MODELS.planner}…`,
    });
    run.tests = await planTests(landing, run.description, run.maxTests, run.cost);
    emit(run, {
      t: Date.now(),
      type: "plan",
      message: `Planned ${run.tests.length} test cases`,
      data: run.tests.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        priority: t.priority,
      })),
    });
    emit(run, { t: Date.now(), type: "cost", data: costSnapshot(run) });
    putRun(run);

    run.status = "running";
    for (const test of run.tests) {
      emit(run, {
        t: Date.now(),
        type: "test_start",
        message: `▶ ${test.title}`,
        data: { id: test.id },
      });

      await runTest(
        test,
        browser,
        run.url,
        run.maxSteps,
        run.cost,
        run.creds,
        (step) => {
          emit(run, {
            t: Date.now(),
            type: "step",
            message: `${test.id} · ${step.action.kind}${step.action.selector ? " " + step.action.selector : ""} — ${step.note}`,
            data: { testId: test.id, step },
          });
          emit(run, { t: Date.now(), type: "cost", data: costSnapshot(run) });
        }
      );

      if (test.status === "failed") {
        run.status = "analyzing";
        emit(run, {
          t: Date.now(),
          type: "status",
          message: `Analyzing failure with ${MODELS.analyst}…`,
        });
        test.bug = await analyzeFailure(test, browser, run.cost);
        emit(run, {
          t: Date.now(),
          type: "bug",
          message: `🐞 ${test.bug.severity.toUpperCase()}: ${test.bug.title}`,
          data: { testId: test.id, bug: test.bug },
        });
        run.status = "running";
      }

      emit(run, {
        t: Date.now(),
        type: "test_end",
        message: `${test.status === "passed" ? "✓" : "✗"} ${test.title}`,
        data: { id: test.id, status: test.status, verdict: test.verdict, bug: test.bug },
      });
      emit(run, { t: Date.now(), type: "cost", data: costSnapshot(run) });
      putRun(run);
    }

    const passed = run.tests.filter((t) => t.status === "passed").length;
    const failed = run.tests.filter((t) => t.status === "failed").length;
    run.summary = `${passed}/${run.tests.length} passed · ${failed} failed`;
    run.status = "done";
    run.finishedAt = Date.now();

    emit(run, {
      t: Date.now(),
      type: "done",
      message: `Run complete — ${run.summary}`,
      data: { passed, failed, cost: costSnapshot(run) },
    });
    putRun(run);
  } catch (err: any) {
    run.status = "error";
    run.error = String(err?.message || err);
    run.finishedAt = Date.now();
    emit(run, { t: Date.now(), type: "error", message: run.error });
    putRun(run);
  } finally {
    await browser.close();
  }
}
