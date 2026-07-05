// Seeds a realistic completed API run into .data/runs so the API UI can be
// verified while the BTL workspace is out of credits. HTTP calls are REAL (via
// the verified executor); the plan text + bug report are stand-ins for the
// credit-blocked LLM stages.
import { promises as fs } from "fs";
import path from "path";
import { runApiTest } from "../src/lib/api/executor";
import type { PlannedApiTest } from "../src/lib/api/planner";
import type { Run } from "../src/lib/types";

const BASE = "https://jsonplaceholder.typicode.com";
const plans: PlannedApiTest[] = [
  {
    title: "Fetch a post, then create one for its author",
    category: "happy", priority: "high", endpoint: "GET /posts/{id} → POST /posts",
    intent: "read a post, extract its userId, and create a new post for that user",
    calls: [
      { label: "get post 1", method: "GET", path: "/posts/1", expect: { status: [200], json_has: ["id", "title", "userId"], asserts: [{ path: "userId", op: "exists" }], max_latency_ms: 4000 }, extract: { uid: "userId" } },
      { label: "create post for user {{uid}}", method: "POST", path: "/posts", body: { title: "QA smoke", body: "created by Verifi", userId: "{{uid}}" }, expect: { status: [201], json_has: ["id"], asserts: [{ path: "title", op: "equals", value: "QA smoke" }] } },
    ],
  },
  {
    title: "List users returns a non-empty array",
    category: "contract", priority: "medium", endpoint: "GET /users",
    intent: "verify the users collection shape",
    calls: [{ label: "list users", method: "GET", path: "/users", expect: { status: [200], asserts: [{ path: "0.email", op: "exists" }, { path: "0.id", op: "type", value: "number" }] } }],
  },
  {
    title: "Unknown post returns 404",
    category: "negative", priority: "medium", endpoint: "GET /posts/99999",
    intent: "missing resource handling",
    calls: [{ label: "get missing post", method: "GET", path: "/posts/99999", expect: { status: [404] } }],
  },
  {
    title: "Create endpoint should reject an empty body",
    category: "edge", priority: "high", endpoint: "POST /posts",
    intent: "input validation (this sandbox does NOT validate — expected to fail, exposing a real gap)",
    calls: [{ label: "post empty body", method: "POST", path: "/posts", body: {}, expect: { status: [400, 422], json_has: ["error"] } }],
  },
];

const apiTests = [];
for (let i = 0; i < plans.length; i++) {
  apiTests.push(await runApiTest(plans[i], `a${i + 1}`, { baseUrl: BASE, auth: { kind: "none" } }, () => {}));
}
// attach a stand-in bug report to any failed test
for (const t of apiTests) {
  if (t.status === "failed") {
    t.bug = {
      severity: "major",
      title: "POST /posts accepts an empty body (no input validation)",
      summary: "Sending an empty JSON body to POST /posts returns 201 Created instead of a 4xx validation error.",
      root_cause: "The create-post handler does not validate required fields (title, body, userId) before persisting.",
      suggested_fix: "Add server-side schema validation; reject missing required fields with 422 and an { error } payload.",
      failing_step: 1,
    };
  }
}

const now = Date.now();
const passed = apiTests.filter((t) => t.status === "passed").length;
const failed = apiTests.filter((t) => t.status === "failed").length;

const run: Run = {
  id: "run_seedapi",
  mode: "api",
  url: BASE,
  maxTests: 4,
  maxSteps: 1,
  status: "done",
  createdAt: now,
  finishedAt: now,
  summary: `${passed}/${apiTests.length} passed · ${failed} failed`,
  tests: [],
  apiTests,
  api: { baseUrl: BASE, description: "JSONPlaceholder fake REST API", auth: { kind: "none" } },
  cost: {
    entries: [
      { stage: "plan", model: "gemini-2.5-flash", benchmark_cost: 0.00013, customer_charge: 0.00212, saved: 0, prompt_tokens: 720, completion_tokens: 520 },
      { stage: "analyze", model: "gpt-5-mini-2025-08-07", benchmark_cost: 0.0004, customer_charge: 0.0039, saved: 0, prompt_tokens: 430, completion_tokens: 410 },
    ],
    total_benchmark: 0.00053, total_charge: 0.00602, total_saved: 0, cache_hits: 0, calls: 2,
    by_model: { "gemini-2.5-flash": 1, "gpt-5-mini-2025-08-07": 1 },
  },
  events: [
    { t: now, type: "status", message: "Loading OpenAPI spec…" },
    { t: now, type: "log", message: "Planning from description — JSONPlaceholder fake REST API" },
    { t: now, type: "plan", message: "Planned 4 API test cases" },
    { t: now, type: "test_end", message: "✓ Fetch a post, then create one for its author (911ms)" },
    { t: now, type: "test_end", message: "✓ List users returns a non-empty array" },
    { t: now, type: "test_end", message: "✓ Unknown post returns 404" },
    { t: now, type: "bug", message: "🐞 MAJOR: POST /posts accepts an empty body (no input validation)" },
    { t: now, type: "test_end", message: "✗ Create endpoint should reject an empty body" },
    { t: now, type: "done", message: `Run complete — ${passed}/${apiTests.length} passed · ${failed} failed` },
  ],
  models: { planner: "gemini-2.5-flash", agent: "gpt-4o-mini", analyst: "gpt-5-mini-2025-08-07" },
};

const dir = path.join(process.cwd(), ".data", "runs");
await fs.mkdir(dir, { recursive: true });
await fs.writeFile(path.join(dir, "run_seedapi.json"), JSON.stringify(run));
console.log(`seeded run_seedapi — ${run.summary}`);
for (const t of apiTests) console.log(`  [${t.status}] ${t.title} (${t.calls.flatMap((c) => c.checks).filter((c) => c.passed).length}/${t.calls.flatMap((c) => c.checks).length} checks)`);
