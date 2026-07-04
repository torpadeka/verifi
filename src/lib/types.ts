// Core domain types for Verifi — AI QA runs powered by the BTL runtime.

export type RunStatus = "queued" | "planning" | "running" | "analyzing" | "done" | "error";
export type TestStatus = "pending" | "running" | "passed" | "failed" | "blocked";
export type StepStatus = "ok" | "fail" | "info";

export interface StepAction {
  kind: "navigate" | "click" | "type" | "press" | "wait" | "assert" | "scroll" | "finish";
  target?: string; // human-readable element description
  selector?: string; // resolved selector actually used
  value?: string; // text typed / url / key / assertion text
}

export interface TestStep {
  index: number;
  thought: string; // model's reasoning for this step
  action: StepAction;
  status: StepStatus;
  note?: string; // execution result / error
  screenshot?: string; // public path to screenshot after action
  ts: number;
}

export interface TestCase {
  id: string;
  title: string;
  category: string; // e.g. "Navigation", "Forms", "Auth", "Content"
  priority: "high" | "medium" | "low";
  steps_plan: string[]; // plain-english planned steps
  expected: string; // expected outcome
  // runtime results
  status: TestStatus;
  steps: TestStep[];
  verdict?: string; // model's final pass/fail explanation
  bug?: BugReport;
  startedAt?: number;
  finishedAt?: number;
  modelUsed?: string;
  diagnostics?: Diagnostics; // console + network errors captured during the test
}

// Runtime signals captured from the real browser while a test runs — surfaces
// issues (JS errors, failed requests) even when the UI still "looks" fine.
export interface Diagnostics {
  console: string[]; // console.error + uncaught page errors
  network: string[]; // failed requests + 4xx/5xx responses
}

export interface BugReport {
  severity: "critical" | "major" | "minor";
  title: string;
  summary: string;
  root_cause: string;
  suggested_fix: string;
  failing_step: number;
  evidence_screenshot?: string;
}

// One LLM call's cost, pulled from BTL response headers.
export interface CostEntry {
  stage: "plan" | "act" | "analyze";
  model: string;
  benchmark_cost: number; // x-btl-benchmark-cost
  customer_charge: number; // x-btl-customer-charge
  saved: number; // x-btl-saved
  cache_tier?: string; // x-btl-cache-tier (present on cache hits)
  request_id?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
}

export interface CostLedger {
  entries: CostEntry[];
  total_benchmark: number;
  total_charge: number;
  total_saved: number;
  cache_hits: number;
  calls: number;
  by_model: Record<string, number>; // model -> call count
}

export interface RunEvent {
  t: number;
  type:
    | "status"
    | "log"
    | "plan"
    | "test_start"
    | "step"
    | "test_end"
    | "cost"
    | "bug"
    | "done"
    | "error";
  message?: string;
  data?: unknown;
}

export interface Run {
  id: string;
  url: string;
  description?: string;
  creds?: { username?: string; password?: string };
  maxTests: number;
  maxSteps: number;
  status: RunStatus;
  createdAt: number;
  finishedAt?: number;
  summary?: string;
  error?: string;
  tests: TestCase[];
  cost: CostLedger;
  events: RunEvent[];
  models: { planner: string; agent: string; analyst: string };
}

export function emptyLedger(): CostLedger {
  return {
    entries: [],
    total_benchmark: 0,
    total_charge: 0,
    total_saved: 0,
    cache_hits: 0,
    calls: 0,
    by_model: {},
  };
}
