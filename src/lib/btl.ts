// Thin client over the BTL runtime (OpenAI-compatible). We use raw fetch instead
// of the OpenAI SDK so we can read the proprietary x-btl-* cost headers on every
// call and fold them into the run's cost ledger.

import type { CostLedger, CostEntry } from "./types";

const BASE = process.env.BTL_BASE_URL || "https://api.badtheorylabs.com/v1";
const KEY = process.env.BTL_API_KEY || "";

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  json?: boolean; // request a JSON object back
  stage: CostEntry["stage"]; // for cost attribution
  ledger?: CostLedger; // if provided, cost is recorded here
}

export interface ChatResult {
  content: string;
  cost: CostEntry;
  raw: any;
}

function num(h: Headers, k: string): number {
  const v = h.get(k);
  const n = v == null ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function appendNudge(messages: ChatMessage[], attempt: number): ChatMessage[] {
  const copy = messages.map((m) => ({ ...m }));
  for (let i = copy.length - 1; i >= 0; i--) {
    if (copy[i].role === "user" && typeof copy[i].content === "string") {
      copy[i] = {
        ...copy[i],
        content: `${copy[i].content}\n\n[retry ${attempt}] Return ONLY a valid JSON object — no markdown, no commentary.`,
      };
      break;
    }
  }
  return copy;
}

// chat() + parseJson() with resilience: models (esp. gemini-2.5-flash) sometimes
// return empty or malformed content, and BTL's exact-cache can replay a bad
// completion. On failure we retry with a varied prompt (busts the cache + re-rolls)
// and drop json_object mode on the final attempt. Cost of every attempt is still
// recorded to the ledger.
export async function chatForJson<T = any>(opts: ChatOptions): Promise<T> {
  const base = opts.messages;
  let lastErr = "empty output";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await chat({
      ...opts,
      messages: attempt === 0 ? base : appendNudge(base, attempt),
      json: attempt < 2, // last try: free-form, lean on parseJson
      temperature:
        attempt === 0 ? opts.temperature : Math.min(0.9, (opts.temperature ?? 0.4) + 0.25 * attempt),
    });
    const content = res.content?.trim();
    if (content) {
      try {
        return parseJson<T>(content);
      } catch (e: any) {
        lastErr = e.message;
      }
    } else {
      lastErr = "empty model output";
    }
  }
  throw new Error(`Planner returned no valid JSON after 3 attempts (${lastErr})`);
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  if (!KEY) throw new Error("BTL_API_KEY missing — set it in .env");

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.max_tokens ?? 1024,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  const post = (b: Record<string, unknown>) =>
    fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(b),
    });

  let res = await post(body);
  let text = await res.text();

  // Not every model in BTL's catalog accepts response_format:json_object.
  // If that's the only problem, retry once without it and lean on parseJson().
  if (!res.ok && opts.json) {
    const retry = { ...body };
    delete retry.response_format;
    res = await post(retry);
    text = await res.text();
  }

  if (!res.ok) {
    throw new Error(`BTL ${res.status}: ${text.slice(0, 500)}`);
  }

  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`BTL returned non-JSON: ${text.slice(0, 300)}`);
  }

  const h = res.headers;
  const cost: CostEntry = {
    stage: opts.stage,
    model: opts.model,
    benchmark_cost: num(h, "x-btl-benchmark-cost"),
    customer_charge: num(h, "x-btl-customer-charge"),
    saved: num(h, "x-btl-saved"),
    cache_tier: h.get("x-btl-cache-tier") || undefined,
    request_id: h.get("x-btl-request-id") || undefined,
    prompt_tokens: data?.usage?.prompt_tokens,
    completion_tokens: data?.usage?.completion_tokens,
  };

  if (opts.ledger) recordCost(opts.ledger, cost);

  const content: string = data?.choices?.[0]?.message?.content ?? "";
  return { content, cost, raw: data };
}

export function recordCost(ledger: CostLedger, c: CostEntry) {
  ledger.entries.push(c);
  ledger.total_benchmark += c.benchmark_cost;
  ledger.total_charge += c.customer_charge;
  ledger.total_saved += c.saved;
  ledger.calls += 1;
  if (c.cache_tier && c.cache_tier !== "miss") ledger.cache_hits += 1;
  ledger.by_model[c.model] = (ledger.by_model[c.model] || 0) + 1;
}

function tryParse(s: string): { ok: true; val: any } | { ok: false } {
  try {
    return { ok: true, val: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

// Return the still-open bracket closers for a JSON prefix, or null if the prefix
// ends inside a string literal (respects escapes).
function openStack(s: string): string[] | null {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return inStr ? null : stack;
}

// Robustly pull a JSON value out of a model response. Handles ```json fences,
// leading prose, and — crucially — truncated output (planner responses cut off
// at max_tokens): it salvages the maximal set of complete objects by closing at
// the last balanced boundary. Returns parsed value or throws.
export function parseJson<T = any>(s: string): T {
  const trimmed = s.trim();

  const direct = tryParse(trimmed);
  if (direct.ok) return direct.val;

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = tryParse(fence[1].trim());
    if (f.ok) return f.val;
  }

  const start = trimmed.search(/[[{]/);
  if (start !== -1) {
    const span = trimmed.slice(start);
    const whole = tryParse(span);
    if (whole.ok) return whole.val;

    // Salvage truncation: walk back from the end to each closing bracket, close
    // any still-open containers, and take the first candidate that parses.
    let attempts = 0;
    for (let i = span.length - 1; i >= 0 && attempts < 200; i--) {
      const ch = span[i];
      if (ch !== "}" && ch !== "]") continue;
      attempts++;
      const sub = span.slice(0, i + 1);
      const stack = openStack(sub);
      if (!stack) continue;
      const candidate = sub + stack.slice().reverse().join("");
      const r = tryParse(candidate);
      if (r.ok) return r.val;
    }
  }

  throw new Error(`Could not parse JSON from model output: ${s.slice(0, 200)}`);
}
