import { NextRequest, NextResponse } from "next/server";
import { listRuns, newId, putRun } from "@/lib/store";
import { emptyLedger, type ApiAuth, type Run, type RunMode } from "@/lib/types";
import { MODELS } from "@/lib/models";
import { executeRun } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function normalizeUrl(u: string): string {
  let s = (u || "").trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

export async function GET() {
  const runs = await listRuns();
  const light = runs.map((r) => {
    const tests = r.mode === "api" ? r.apiTests || [] : r.tests || [];
    return {
      id: r.id,
      mode: r.mode || "ui",
      url: r.url,
      status: r.status,
      createdAt: r.createdAt,
      summary: r.summary,
      passed: tests.filter((t) => t.status === "passed").length,
      failed: tests.filter((t) => t.status === "failed").length,
      total: tests.length,
      saved: r.cost.total_saved,
      charge: r.cost.total_charge,
    };
  });
  return NextResponse.json({ runs: light });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: RunMode = body.mode === "api" ? "api" : "ui";

  if (mode === "api") {
    const baseUrl = normalizeUrl(body.baseUrl || body.url || "");
    const specUrl = (body.specUrl || "").trim() || undefined;
    if (!baseUrl && !specUrl) {
      return NextResponse.json(
        { error: "Provide a base URL or an OpenAPI spec URL/JSON" },
        { status: 400 }
      );
    }
    const auth: ApiAuth =
      body.authKind && body.authKind !== "none"
        ? {
            kind: body.authKind,
            token: body.authToken,
            username: body.authUser,
            password: body.authPass,
            headerName: body.authHeaderName,
            headerValue: body.authHeaderValue,
          }
        : { kind: "none" };

    const run: Run = {
      id: newId(),
      mode: "api",
      url: baseUrl || specUrl || "",
      maxTests: Math.min(Math.max(Number(body.maxTests) || 5, 1), 12),
      maxSteps: 1,
      status: "queued",
      createdAt: Date.now(),
      tests: [],
      apiTests: [],
      api: {
        baseUrl,
        specUrl,
        description: (body.description || "").slice(0, 1500) || undefined,
        auth,
      },
      cost: emptyLedger(),
      events: [],
      models: { planner: MODELS.planner, agent: MODELS.agent, analyst: MODELS.analyst },
    };
    putRun(run);
    void executeRun(run);
    return NextResponse.json({ id: run.id });
  }

  // ── UI mode ──
  const url = normalizeUrl(body.url || "");
  if (!/^https?:\/\/.+\..+/.test(url)) {
    return NextResponse.json({ error: "Provide a valid URL" }, { status: 400 });
  }

  const run: Run = {
    id: newId(),
    mode: "ui",
    url,
    description: (body.description || "").slice(0, 1200) || undefined,
    creds:
      body.username || body.password
        ? { username: body.username, password: body.password }
        : undefined,
    maxTests: Math.min(Math.max(Number(body.maxTests) || 5, 1), 10),
    maxSteps: Math.min(Math.max(Number(body.maxSteps) || 8, 3), 14),
    status: "queued",
    createdAt: Date.now(),
    tests: [],
    apiTests: [],
    cost: emptyLedger(),
    events: [],
    models: { planner: MODELS.planner, agent: MODELS.agent, analyst: MODELS.analyst },
  };
  putRun(run);
  void executeRun(run);
  return NextResponse.json({ id: run.id });
}
