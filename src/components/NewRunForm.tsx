"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRunForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [maxTests, setMaxTests] = useState(5);
  const [maxSteps, setMaxSteps] = useState(8);
  const [showAdv, setShowAdv] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, description, maxTests, maxSteps, username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start run");
      router.push(`/run/${data.id}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-2xl mx-auto w-full rounded-2xl border border-line bg-panel/80 p-5 sm:p-6 shadow-2xl shadow-black/40"
    >
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.com"
          required
          className="flex-1 bg-ink border border-line rounded-xl px-4 py-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition placeholder:text-mut/50"
        />
        <button
          disabled={busy}
          className="rounded-xl px-5 py-3 font-semibold bg-gradient-to-r from-brand to-brand2 text-ink disabled:opacity-60 hover:brightness-110 active:scale-[.98] transition whitespace-nowrap"
        >
          {busy ? "Starting…" : "Run QA →"}
        </button>
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional: describe your app or what to focus on (e.g. 'e-commerce store, test search and checkout')"
        rows={2}
        className="mt-3 w-full bg-ink border border-line rounded-xl px-4 py-3 text-sm outline-none focus:border-brand/60 resize-none placeholder:text-mut/50"
      />

      <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-mut">
        <label className="flex items-center gap-2">
          Tests
          <input
            type="range"
            min={1}
            max={10}
            value={maxTests}
            onChange={(e) => setMaxTests(+e.target.value)}
            className="accent-brand"
          />
          <span className="text-fg w-5 font-mono text-brand2">{maxTests}</span>
        </label>
        <label className="flex items-center gap-2">
          Max steps
          <input
            type="range"
            min={3}
            max={14}
            value={maxSteps}
            onChange={(e) => setMaxSteps(+e.target.value)}
            className="accent-brand"
          />
          <span className="w-5 font-mono text-brand2">{maxSteps}</span>
        </label>
        <button
          type="button"
          onClick={() => setShowAdv((s) => !s)}
          className="ml-auto text-xs underline decoration-dotted hover:text-fg"
        >
          {showAdv ? "− login" : "+ login (optional)"}
        </button>
      </div>

      {showAdv && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="test username"
            className="bg-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="test password"
            className="bg-ink border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </div>
      )}

      {err && <p className="mt-3 text-sm text-bad">{err}</p>}
    </form>
  );
}
