import { NextRequest, NextResponse } from "next/server";
import { listRuns, newId, putRun } from "@/lib/store";
import { emptyLedger, type Run } from "@/lib/types";
import { MODELS } from "@/lib/models";
import { executeRun } from "@/lib/agent/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function normalizeUrl(u: string): string {
  let s = (u || "").trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

export async function GET() {
  const runs = await listRuns();
  // trim payload for the list view
  const light = runs.map((r) => ({
    id: r.id,
    url: r.url,
    status: r.status,
    createdAt: r.createdAt,
    summary: r.summary,
    passed: r.tests.filter((t) => t.status === "passed").length,
    failed: r.tests.filter((t) => t.status === "failed").length,
    total: r.tests.length,
    saved: r.cost.total_saved,
    charge: r.cost.total_charge,
  }));
  return NextResponse.json({ runs: light });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = normalizeUrl(body.url || "");
  if (!/^https?:\/\/.+\..+/.test(url)) {
    return NextResponse.json({ error: "Provide a valid URL" }, { status: 400 });
  }

  const run: Run = {
    id: newId(),
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
    cost: emptyLedger(),
    events: [],
    models: { planner: MODELS.planner, agent: MODELS.agent, analyst: MODELS.analyst },
  };
  putRun(run);

  // detached — the run streams its progress via SSE
  void executeRun(run);

  return NextResponse.json({ id: run.id });
}
