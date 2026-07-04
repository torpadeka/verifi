import NewRunForm from "@/components/NewRunForm";
import RunsList from "@/components/RunsList";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="text-center pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-line bg-panel text-xs text-mut mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse-dot" />
          Autonomous browser QA · every call on the BTL runtime
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Ship with confidence.
          <br />
          <span className="bg-gradient-to-r from-brand via-brand2 to-brand bg-clip-text text-transparent">
            Let AI test your app.
          </span>
        </h1>
        <p className="mt-4 text-mut max-w-xl mx-auto">
          Point Verifi at any URL. An AI agent explores it in a real browser,
          writes end-to-end tests, runs them, and files bug reports with
          screenshots and root-cause fixes.
        </p>
      </section>

      <NewRunForm />

      <section>
        <h2 className="text-sm font-semibold text-mut uppercase tracking-wider mb-3">
          Recent runs
        </h2>
        <RunsList />
      </section>
    </div>
  );
}
