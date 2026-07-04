// Per-test execution loop. For each test case we drive the browser agentically:
// screenshot + element list -> vision model decides the next action -> execute ->
// repeat until the model declares pass/fail or we hit the step budget.

import { chat, parseJson } from "../btl";
import { MODELS } from "../models";
import type { CostLedger, TestCase, TestStep, StepAction } from "../types";
import type { BrowserAgent } from "./browser";

interface Decision {
  thought: string;
  action: "click" | "type" | "press" | "scroll" | "navigate" | "assert" | "finish";
  ref?: number;
  value?: string;
  status?: "continue" | "pass" | "fail";
}

const SYS = `You are Verifi, an autonomous browser QA agent. You execute ONE test case by interacting with a live web page like a real user. Each turn you see a screenshot and a numbered list of interactive elements. Choose the single next best action.

Respond with ONLY a JSON object:
{"thought":"short reasoning","action":"click|type|press|scroll|navigate|assert|finish","ref":<element number for click/type>,"value":"text to type, key to press, url to navigate, or substring to assert","status":"continue|pass|fail"}

Rules:
- Refer to elements by their #number ("ref").
- Use "type" then a separate "press" with value "Enter" to submit inputs/search.
- Use "assert" with a "value" substring to verify expected text is visible.
- Use "finish" with status "pass" when the expected outcome is clearly met, or "fail" when it clearly is not or you are stuck. Always finish within the step budget.
- Never repeat an action that already failed. Be decisive.`;

export async function runTest(
  test: TestCase,
  browser: BrowserAgent,
  startUrl: string,
  maxSteps: number,
  ledger: CostLedger,
  creds: { username?: string; password?: string } | undefined,
  onStep: (step: TestStep) => void
): Promise<void> {
  test.status = "running";
  test.startedAt = Date.now();

  // fresh state per test — clear diagnostics so this test's load + actions are
  // the only console/network errors it carries.
  browser.resetDiagnostics();
  await browser.gotoUrl(startUrl).catch(() => {});

  const history: string[] = [];

  for (let i = 0; i < maxSteps; i++) {
    const snap = await browser.snapshot(`${test.id}-s${i}`);
    const imgData = await browser.dataUrlOf(snap.screenshot);

    const elementList = snap.elements
      .map(
        (e) =>
          `#${e.ref} <${e.tag}${e.editable ? " editable" : ""}> ${e.type} — ${e.name || "(no label)"}`
      )
      .join("\n");

    const credLine = creds?.username
      ? `\nCREDENTIALS available if a login is required: username="${creds.username}" password="${creds.password}"`
      : "";

    const userText = `TEST CASE: ${test.title}
CATEGORY: ${test.category}
PLANNED STEPS: ${test.steps_plan.join(" | ")}
EXPECTED OUTCOME: ${test.expected}${credLine}

STEP ${i + 1} of ${maxSteps}.
CURRENT URL: ${snap.url}
PAGE TITLE: ${snap.title}
ACTIONS SO FAR:
${history.length ? history.join("\n") : "(none yet)"}

INTERACTIVE ELEMENTS:
${elementList || "(none detected — try scroll or assert)"}

Decide the next action as JSON.`;

    const content: any[] = [{ type: "text", text: userText }];
    if (imgData) content.push({ type: "image_url", image_url: { url: imgData } });

    let decision: Decision;
    try {
      const { content: out } = await chat({
        model: MODELS.agent,
        stage: "act",
        ledger,
        json: true,
        temperature: 0.1,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYS },
          { role: "user", content },
        ],
      });
      decision = parseJson<Decision>(out);
    } catch (err: any) {
      decision = {
        thought: `agent error: ${err.message}`,
        action: "finish",
        status: "fail",
      };
    }

    const action: StepAction = { kind: decision.action, value: decision.value };
    let note = "";
    let ok = true;

    try {
      switch (decision.action) {
        case "click":
          note = await browser.click(decision.ref ?? -1);
          break;
        case "type":
          note = await browser.type(decision.ref ?? -1, decision.value ?? "");
          break;
        case "press":
          note = await browser.press(decision.value ?? "Enter");
          break;
        case "scroll":
          note = await browser.scroll();
          break;
        case "navigate":
          note = await browser.gotoUrl(decision.value ?? startUrl);
          break;
        case "assert": {
          const r = await browser.assertText(decision.value ?? "");
          note = r.note;
          ok = r.ok;
          break;
        }
        case "finish":
          note = `finished: ${decision.status}`;
          break;
      }
    } catch (err: any) {
      ok = false;
      note = `action failed: ${String(err.message).slice(0, 140)}`;
    }

    const shot = await browser.screenshot(`${test.id}-after${i}`);
    const step: TestStep = {
      index: i,
      thought: decision.thought || "",
      action: { ...action, selector: decision.ref != null ? `#${decision.ref}` : undefined },
      status: ok ? "ok" : "fail",
      note,
      screenshot: shot,
      ts: Date.now(),
    };
    test.steps.push(step);
    onStep(step);

    history.push(`#${i + 1} ${decision.action}${decision.ref != null ? ` #${decision.ref}` : ""}${decision.value ? ` "${decision.value.slice(0, 24)}"` : ""} -> ${note}`);
    if (history.length > 8) history.shift();

    if (decision.action === "finish") {
      test.status = decision.status === "pass" ? "passed" : "failed";
      test.verdict = decision.thought;
      break;
    }
    if (decision.action === "assert" && !ok) {
      // a failed assertion is a strong fail signal, but let the agent try to recover
      // unless it's the last step
    }
  }

  if (test.status === "running") {
    // ran out of steps without a verdict — treat as failed (inconclusive)
    test.status = "failed";
    test.verdict = "Step budget exhausted without reaching the expected outcome.";
  }
  test.diagnostics = browser.getDiagnostics();
  test.finishedAt = Date.now();
}
