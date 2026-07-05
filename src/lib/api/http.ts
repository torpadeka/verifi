// HTTP driver for API-testing mode. Builds a request from a planned call (with
// {{variable}} interpolation + auth), sends it, and captures a normalized
// response. No browser — this whole path is stateless and serverless-friendly.

import type { ApiAuth, HttpRequest, HttpResponse } from "../types";

export type Vars = Record<string, string>;

const MAX_BODY = 8000;

// Replace {{name}} tokens in any string using the vars bag.
export function interpolate(input: string, vars: Vars): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) =>
    k in vars ? vars[k] : `{{${k}}}`
  );
}

function deepInterpolate(v: unknown, vars: Vars): unknown {
  if (typeof v === "string") return interpolate(v, vars);
  if (Array.isArray(v)) return v.map((x) => deepInterpolate(x, vars));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[interpolate(k, vars)] = deepInterpolate(val, vars);
    return out;
  }
  return v;
}

function authHeaders(auth?: ApiAuth): Record<string, string> {
  if (!auth || auth.kind === "none") return {};
  if (auth.kind === "bearer" && auth.token)
    return { Authorization: `Bearer ${auth.token}` };
  if (auth.kind === "basic" && auth.username != null)
    return {
      Authorization:
        "Basic " + Buffer.from(`${auth.username}:${auth.password ?? ""}`).toString("base64"),
    };
  if (auth.kind === "header" && auth.headerName)
    return { [auth.headerName]: auth.headerValue ?? "" };
  return {};
}

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export interface PlannedCall {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
}

export async function sendRequest(
  call: PlannedCall,
  baseUrl: string,
  auth: ApiAuth | undefined,
  vars: Vars
): Promise<{ request: HttpRequest; response: HttpResponse | null; error?: string }> {
  const method = (call.method || "GET").toUpperCase();
  let path = interpolate(call.path || "/", vars);

  // query params
  const q = call.query
    ? Object.entries(call.query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(interpolate(String(v), vars))}`)
        .join("&")
    : "";
  if (q) path += (path.includes("?") ? "&" : "?") + q;

  const url = joinUrl(interpolate(baseUrl, vars), path);

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeaders(auth),
  };
  for (const [k, v] of Object.entries(call.headers || {})) headers[k] = interpolate(String(v), vars);

  let bodyStr: string | undefined;
  if (call.body != null && method !== "GET" && method !== "HEAD") {
    const b = deepInterpolate(call.body, vars);
    bodyStr = typeof b === "string" ? b : JSON.stringify(b);
    if (!Object.keys(headers).some((h) => h.toLowerCase() === "content-type"))
      headers["Content-Type"] = "application/json";
  }

  const request: HttpRequest = { method, url, headers, body: bodyStr };

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { method, headers, body: bodyStr, signal: ctrl.signal });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    const hdrs: Record<string, string> = {};
    res.headers.forEach((v, k) => (hdrs[k] = v));
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      /* not json */
    }
    const response: HttpResponse = {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      latencyMs,
      headers: hdrs,
      body: text.slice(0, MAX_BODY),
      json,
    };
    return { request, response };
  } catch (err: any) {
    return {
      request,
      response: null,
      error: err?.name === "AbortError" ? "request timed out (15s)" : String(err?.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// Read a dotted / bracketed path out of a parsed JSON value.
export function readPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}
