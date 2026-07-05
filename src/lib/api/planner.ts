// API test planning. Given a base URL plus either an OpenAPI endpoint list or a
// natural-language description, the planner model designs a prioritized set of
// API test cases — happy paths, negative/edge cases, and multi-call chains
// (e.g. auth → use token) with per-call assertions and variable extraction.

import { chat, parseJson } from "../btl";
import { MODELS } from "../models";
import type { ApiConfig, CostLedger } from "../types";

export type AssertOp = "exists" | "equals" | "contains" | "type" | "gt" | "lt";

export interface PlannedCheck {
  status?: number[];
  json_has?: string[];
  asserts?: { path: string; op: AssertOp; value?: unknown }[];
  max_latency_ms?: number;
}

export interface PlannedApiCall {
  label: string;
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  expect: PlannedCheck;
  extract?: Record<string, string>; // varName -> json path in response
}

export interface PlannedApiTest {
  title: string;
  category: string;
  priority: "high" | "medium" | "low";
  endpoint: string;
  intent: string;
  calls: PlannedApiCall[];
}

export async function planApiTests(
  api: ApiConfig,
  endpointList: string | undefined,
  maxTests: number,
  ledger: CostLedger
): Promise<PlannedApiTest[]> {
  const authNote =
    api.auth && api.auth.kind !== "none"
      ? `Auth is preconfigured (${api.auth.kind}) and applied automatically to every request — do NOT add Authorization headers yourself.`
      : `No auth configured. If an endpoint needs auth, include a login/token call first and extract the token into a variable, then reference it as a header {{token}} on later calls.`;

  const sys = `You are a senior API test engineer. Design end-to-end API test cases that an HTTP runner will execute against a live server. Cover: happy paths, negative/edge cases (missing/invalid fields, unauthorized, not-found), and realistic multi-call chains where one call's output feeds the next. Assertions must be verifiable from the HTTP response alone.

Use {{variableName}} placeholders to reference values extracted from earlier calls in the same test. Extract values from a response with "extract": {"varName": "json.path.here"}.

Each call declares "expect":
- status: array of acceptable status codes (e.g. [200] or [400,422])
- json_has: response JSON must contain these top-level-ish keys (dot paths allowed)
- asserts: [{"path":"data.id","op":"exists|equals|contains|type|gt|lt","value":<optional>}]
- max_latency_ms: optional latency ceiling

Keep bodies realistic and minimal. Never use destructive operations on data you didn't create in the same test.`;

  const target = endpointList
    ? `BASE URL: ${api.baseUrl}\n\nAVAILABLE ENDPOINTS (from OpenAPI spec):\n${endpointList}`
    : `BASE URL: ${api.baseUrl}\n\nAPI DESCRIPTION (from user): ${api.description || "(none — infer common REST endpoints)"}`;

  const user = `${target}

${authNote}

Produce exactly ${maxTests} distinct API test cases as JSON:
{"tests":[{
  "title":"...",
  "category":"happy|negative|auth|edge|contract",
  "priority":"high|medium|low",
  "endpoint":"METHOD /path",
  "intent":"what this verifies",
  "calls":[{
    "label":"...",
    "method":"GET|POST|PUT|PATCH|DELETE",
    "path":"/resource/{{id}}",
    "headers":{},
    "query":{},
    "body":{},
    "expect":{"status":[200],"json_has":["id"],"asserts":[{"path":"id","op":"exists"}]},
    "extract":{"id":"id"}
  }]
}]}
Return ONLY the JSON object.`;

  const { content } = await chat({
    model: MODELS.planner,
    stage: "plan",
    ledger,
    json: true,
    temperature: 0.4,
    max_tokens: 3000,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const parsed = parseJson<{ tests: PlannedApiTest[] }>(content);
  return (parsed.tests || []).slice(0, maxTests).map((t) => ({
    ...t,
    calls: (t.calls || []).map((c) => ({ ...c, expect: c.expect || {} })),
  }));
}
