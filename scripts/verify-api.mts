// Verifies the deterministic API-testing core (no BTL calls): HTTP driver,
// executor, assertion engine, variable chaining, and the OpenAPI parser.
import { runApiTest } from "../src/lib/api/executor";
import { loadSpec, summarizeSpec, endpointsToPrompt } from "../src/lib/api/openapi";
import type { PlannedApiTest } from "../src/lib/api/planner";

const BASE = "https://jsonplaceholder.typicode.com";

const planned: PlannedApiTest[] = [
  {
    title: "Fetch a post then create one (chained)",
    category: "happy",
    priority: "high",
    endpoint: "GET /posts/{id}",
    intent: "read + write with variable extraction",
    calls: [
      {
        label: "get post 1",
        method: "GET",
        path: "/posts/1",
        expect: { status: [200], json_has: ["id", "title"], asserts: [{ path: "userId", op: "exists" }] },
        extract: { uid: "userId" },
      },
      {
        label: "create post for that user",
        method: "POST",
        path: "/posts",
        body: { title: "hello", body: "world", userId: "{{uid}}" },
        expect: { status: [201], json_has: ["id"], asserts: [{ path: "title", op: "equals", value: "hello" }] },
      },
    ],
  },
  {
    title: "Not-found returns 404",
    category: "negative",
    priority: "medium",
    endpoint: "GET /posts/99999",
    intent: "missing resource",
    calls: [{ label: "get missing", method: "GET", path: "/posts/99999", expect: { status: [404] } }],
  },
  {
    title: "Deliberately wrong expectation (should FAIL)",
    category: "edge",
    priority: "low",
    endpoint: "GET /posts/1",
    intent: "prove assertions can fail",
    calls: [{ label: "expect impossible status", method: "GET", path: "/posts/1", expect: { status: [500] } }],
  },
];

for (const p of planned) {
  const t = await runApiTest(p, "a", { baseUrl: BASE, auth: { kind: "none" } }, () => {});
  console.log(`\n[${t.status}] ${t.title}  (${t.latencyMs}ms)`);
  for (const c of t.calls) {
    console.log(`   ${c.request.method} ${c.request.url} -> ${c.response?.status ?? "ERR"}`);
    for (const ch of c.checks) console.log(`      ${ch.passed ? "OK" : "XX"} ${ch.name}${ch.detail ? ` [${ch.detail}]` : ""}`);
  }
}

console.log("\n=== OpenAPI parser (petstore3) ===");
try {
  const spec = await loadSpec("https://petstore3.swagger.io/api/v3/openapi.json");
  const sum = summarizeSpec(spec, "https://petstore3.swagger.io/api/v3/openapi.json");
  console.log("title:", sum.title, "| base:", sum.baseUrl, "| endpoints:", sum.endpoints.length);
  console.log(endpointsToPrompt(sum.endpoints.slice(0, 6)));
} catch (e: any) {
  console.log("spec parse failed:", e.message);
}
