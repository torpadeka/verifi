// Test-plan generation. Given the target app's landing snapshot (title, visible
// text, interactive elements) plus an optional product description, ask the
// planner model to propose a prioritized set of end-to-end test cases.

import { chat, parseJson } from "../btl";
import { MODELS } from "../models";
import type { CostLedger, TestCase } from "../types";
import type { Snapshot } from "./browser";

interface PlannedCase {
  title: string;
  category: string;
  priority: "high" | "medium" | "low";
  steps: string[];
  expected: string;
}

export async function planTests(
  snap: Snapshot,
  description: string | undefined,
  maxTests: number,
  ledger: CostLedger
): Promise<TestCase[]> {
  const elementList = snap.elements
    .map((e) => `#${e.ref} <${e.tag}${e.editable ? " editable" : ""}> ${e.type} — ${e.name || "(no label)"}`)
    .join("\n");

  const sys = `You are a senior QA engineer. You design end-to-end UI test cases for a web app that a browser-automation agent will execute by clicking and typing like a real user. Tests must be realistic, self-contained, and verifiable purely through what is visible in the browser. Prefer high-value user journeys (navigation, search, forms, primary CTAs, content correctness, error handling). Do NOT invent destructive actions (no deleting data, no payments). Keep each test to 3-7 concrete steps.`;

  const user = `TARGET URL: ${snap.url}
PAGE TITLE: ${snap.title}
${description ? `PRODUCT DESCRIPTION (from user): ${description}\n` : ""}
VISIBLE TEXT (excerpt):
${snap.text.slice(0, 1500)}

INTERACTIVE ELEMENTS ON LANDING PAGE:
${elementList || "(none detected)"}

Produce exactly ${maxTests} distinct test cases as JSON:
{"tests":[{"title":"...","category":"Navigation|Search|Forms|Auth|Content|Errors|Responsiveness","priority":"high|medium|low","steps":["step 1","step 2"],"expected":"the observable success condition"}]}
Return ONLY the JSON object.`;

  const { content } = await chat({
    model: MODELS.planner,
    stage: "plan",
    ledger,
    json: true,
    temperature: 0.4,
    max_tokens: 1800,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const parsed = parseJson<{ tests: PlannedCase[] }>(content);
  const cases = (parsed.tests || []).slice(0, maxTests);

  return cases.map((c, i) => ({
    id: `t${i + 1}`,
    title: c.title || `Test ${i + 1}`,
    category: c.category || "General",
    priority: c.priority || "medium",
    steps_plan: c.steps || [],
    expected: c.expected || "",
    status: "pending" as const,
    steps: [],
    modelUsed: MODELS.agent,
  }));
}
