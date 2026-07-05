"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "ui" | "api";
type AuthKind = "none" | "bearer" | "basic" | "header";

export default function NewRunForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ui");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // shared
  const [description, setDescription] = useState("");
  const [maxTests, setMaxTests] = useState(5);

  // ui mode
  const [url, setUrl] = useState("");
  const [maxSteps, setMaxSteps] = useState(8);
  const [showAdv, setShowAdv] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // api mode
  const [baseUrl, setBaseUrl] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [authKind, setAuthKind] = useState<AuthKind>("none");
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authHeaderName, setAuthHeaderName] = useState("");
  const [authHeaderValue, setAuthHeaderValue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const payload =
        mode === "ui"
          ? { mode, url, description, maxTests, maxSteps, username, password }
          : {
              mode,
              baseUrl,
              specUrl,
              description,
              maxTests,
              authKind,
              authToken,
              authUser,
              authPass,
              authHeaderName,
              authHeaderValue,
            };
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start run");
      router.push(`/run/${data.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  const input =
    "w-full bg-fog border border-line2/60 rounded-none px-4 h-12 text-[15px] text-carbon outline-none focus:border-carbon transition placeholder:text-pebble";

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto w-full bg-snow rounded-[24px] p-6 sm:p-7 shadow-card">
      {/* mode toggle */}
      <div className="flex gap-1 p-1 bg-fog rounded-badge w-max mx-auto mb-5">
        {(["ui", "api"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-5 py-1.5 rounded-badge text-[13px] font-medium transition ${
              mode === m ? "bg-snow text-carbon shadow-subtle" : "text-stone hover:text-carbon"
            }`}
          >
            {m === "ui" ? "Web UI" : "API"}
          </button>
        ))}
      </div>

      {mode === "ui" ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com"
              required
              aria-label="Target app URL"
              className="flex-1 bg-fog border border-line2/60 rounded-none px-4 h-12 text-[16px] text-carbon outline-none focus:border-carbon transition placeholder:text-pebble"
            />
            <button
              disabled={busy}
              className="rounded-[28px] px-6 h-12 font-medium text-[15px] bg-tangerine text-carbon shadow-btn disabled:opacity-60 hover:brightness-[1.03] active:scale-[.985] transition whitespace-nowrap"
            >
              {busy ? "Starting…" : "Run QA"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional: describe your app or what to focus on (e.g. 'e-commerce store, test search and checkout')"
            rows={2}
            className="mt-3 w-full bg-fog border border-line2/60 rounded-none px-4 py-3 text-[14px] text-carbon outline-none focus:border-carbon resize-none placeholder:text-pebble"
          />
          <div className="mt-4 flex flex-wrap items-center gap-6 text-[14px] text-stone">
            <Slider label="Tests" value={maxTests} min={1} max={10} onChange={setMaxTests} />
            <Slider label="Max steps" value={maxSteps} min={3} max={14} onChange={setMaxSteps} />
            <button
              type="button"
              onClick={() => setShowAdv((s) => !s)}
              className="ml-auto text-[13px] text-stone underline decoration-dotted underline-offset-4 hover:text-carbon transition"
            >
              {showAdv ? "− login" : "+ login (optional)"}
            </button>
          </div>
          {showAdv && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="test username" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="test password" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.your-service.com"
              aria-label="API base URL"
              className="flex-1 bg-fog border border-line2/60 rounded-none px-4 h-12 text-[16px] text-carbon outline-none focus:border-carbon transition placeholder:text-pebble"
            />
            <button
              disabled={busy}
              className="rounded-[28px] px-6 h-12 font-medium text-[15px] bg-tangerine text-carbon shadow-btn disabled:opacity-60 hover:brightness-[1.03] active:scale-[.985] transition whitespace-nowrap"
            >
              {busy ? "Starting…" : "Test API"}
            </button>
          </div>
          <input
            value={specUrl}
            onChange={(e) => setSpecUrl(e.target.value)}
            placeholder="OpenAPI / Swagger URL or pasted JSON (optional — fills base URL + endpoints)"
            aria-label="OpenAPI spec"
            className={`mt-3 ${input}`}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional: describe the API if you have no spec (e.g. 'REST API with /posts, /users; JWT auth')"
            rows={2}
            className="mt-3 w-full bg-fog border border-line2/60 rounded-none px-4 py-3 text-[14px] text-carbon outline-none focus:border-carbon resize-none placeholder:text-pebble"
          />

          {/* auth */}
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] text-stone">
            <span>Auth</span>
            {(["none", "bearer", "basic", "header"] as AuthKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAuthKind(k)}
                className={`px-3 py-1 rounded-badge text-[13px] border transition ${
                  authKind === k ? "border-carbon text-carbon bg-fog" : "border-line2/50 text-stone hover:text-carbon"
                }`}
              >
                {k}
              </button>
            ))}
            <div className="ml-auto">
              <Slider label="Tests" value={maxTests} min={1} max={12} onChange={setMaxTests} />
            </div>
          </div>
          {authKind === "bearer" && (
            <input value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="bearer token" className={`mt-3 ${input}`} />
          )}
          {authKind === "basic" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={authUser} onChange={(e) => setAuthUser(e.target.value)} placeholder="username" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
              <input value={authPass} onChange={(e) => setAuthPass(e.target.value)} type="password" placeholder="password" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
            </div>
          )}
          {authKind === "header" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input value={authHeaderName} onChange={(e) => setAuthHeaderName(e.target.value)} placeholder="header name (e.g. X-API-Key)" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
              <input value={authHeaderValue} onChange={(e) => setAuthHeaderValue(e.target.value)} placeholder="header value" className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble" />
            </div>
          )}
        </>
      )}

      {err && <p className="mt-3 text-[13px] text-fail">{err}</p>}
    </form>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-2.5">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} className="accent-tangerine" />
      <span className="w-5 font-medium text-carbon tabular-nums">{value}</span>
    </label>
  );
}
