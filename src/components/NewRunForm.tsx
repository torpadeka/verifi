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
      className="max-w-2xl mx-auto w-full bg-snow rounded-[24px] p-6 sm:p-7 shadow-card"
    >
      {/* URL row: square input + orange pill button */}
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
        aria-label="App description"
        className="mt-3 w-full bg-fog border border-line2/60 rounded-none px-4 py-3 text-[14px] text-carbon outline-none focus:border-carbon resize-none placeholder:text-pebble"
      />

      <div className="mt-4 flex flex-wrap items-center gap-6 text-[14px] text-stone">
        <label className="flex items-center gap-2.5">
          Tests
          <input
            type="range"
            min={1}
            max={10}
            value={maxTests}
            onChange={(e) => setMaxTests(+e.target.value)}
            className="accent-tangerine"
          />
          <span className="w-5 font-medium text-carbon tabular-nums">{maxTests}</span>
        </label>
        <label className="flex items-center gap-2.5">
          Max steps
          <input
            type="range"
            min={3}
            max={14}
            value={maxSteps}
            onChange={(e) => setMaxSteps(+e.target.value)}
            className="accent-tangerine"
          />
          <span className="w-5 font-medium text-carbon tabular-nums">{maxSteps}</span>
        </label>
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
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="test username"
            aria-label="Test username"
            className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="test password"
            aria-label="Test password"
            className="bg-fog border border-line2/60 rounded-none px-3 h-11 text-[14px] text-carbon outline-none focus:border-carbon placeholder:text-pebble"
          />
        </div>
      )}

      {err && <p className="mt-3 text-[13px] text-fail">{err}</p>}
    </form>
  );
}
