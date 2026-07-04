import NewRunForm from "@/components/NewRunForm";
import RunsList from "@/components/RunsList";

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="text-center pt-10 pb-2 animate-rise">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-[100px] bg-snow shadow-subtle text-[13px] text-graphite font-medium mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-pass animate-pulse-dot" />
          Autonomous browser QA · every call on the BTL runtime
        </div>
        <h1 className="font-display text-carbon text-[clamp(40px,7.5vw,70px)] leading-[1.12]">
          Ship with confidence.
          <br />
          Let AI test your app.
        </h1>
        <p className="mt-5 text-stone text-[18px] leading-[1.5] max-w-xl mx-auto">
          Point Verifi at any URL. An AI agent explores it in a real browser,
          writes end-to-end tests, runs them, and files bug reports with
          screenshots and root-cause fixes.
        </p>
      </section>

      <NewRunForm />

      <section>
        <h2 className="text-[13px] font-medium text-stone uppercase tracking-[0.08em] mb-4">
          Recent runs
        </h2>
        <RunsList />
      </section>
    </div>
  );
}
