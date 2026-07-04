// Run store: in-memory source of truth + JSON persistence + a tiny pub/sub so
// the SSE endpoint can stream live events. Uses globalThis so state survives
// Next.js dev hot-reloads.

import { promises as fs } from "fs";
import path from "path";
import type { Run, RunEvent } from "./types";

type Sub = (e: RunEvent) => void;

interface StoreState {
  runs: Map<string, Run>;
  subs: Map<string, Set<Sub>>;
}

const g = globalThis as unknown as { __verifi?: StoreState };
const state: StoreState =
  g.__verifi ?? (g.__verifi = { runs: new Map(), subs: new Map() });

const DATA_DIR = path.join(process.cwd(), ".data", "runs");

async function persist(run: Run) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(
      path.join(DATA_DIR, `${run.id}.json`),
      JSON.stringify(run),
      "utf8"
    );
  } catch {
    /* best-effort */
  }
}

export function putRun(run: Run) {
  state.runs.set(run.id, run);
  void persist(run);
}

export async function getRun(id: string): Promise<Run | undefined> {
  const inMem = state.runs.get(id);
  if (inMem) return inMem;
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf8");
    const run = JSON.parse(raw) as Run;
    state.runs.set(id, run);
    return run;
  } catch {
    return undefined;
  }
}

export async function listRuns(): Promise<Run[]> {
  // seed from disk on cold start
  try {
    const files = await fs.readdir(DATA_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const id = f.replace(/\.json$/, "");
      if (!state.runs.has(id)) {
        try {
          const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
          state.runs.set(id, JSON.parse(raw));
        } catch {
          /* skip */
        }
      }
    }
  } catch {
    /* no data dir yet */
  }
  return [...state.runs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

// pub/sub -------------------------------------------------------------

export function emit(run: Run, e: RunEvent) {
  run.events.push(e);
  const subs = state.subs.get(run.id);
  if (subs) for (const s of subs) s(e);
  void persist(run);
}

export function subscribe(runId: string, cb: Sub): () => void {
  let set = state.subs.get(runId);
  if (!set) {
    set = new Set();
    state.subs.set(runId, set);
  }
  set.add(cb);
  return () => set!.delete(cb);
}

export function newId(): string {
  // time-ordered-ish id without Date.now dependency issues in normal runtime
  const rand = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36);
  return `run_${t}${rand}`;
}
