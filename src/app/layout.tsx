import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verifi — AI QA, powered by BTL Runtime",
  description:
    "Point Verifi at any web app. An AI agent explores it in a real browser, writes and runs end-to-end tests, and files bug reports — all on the BTL runtime.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line/70 backdrop-blur sticky top-0 z-30 bg-ink/70">
          <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 group">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand to-brand2 text-ink font-black text-sm">
                V
              </span>
              <span className="font-semibold tracking-tight">
                Verifi
                <span className="text-mut font-normal"> · AI QA</span>
              </span>
            </a>
            <div className="flex items-center gap-4 text-xs text-mut">
              <span className="hidden sm:inline">runtime by</span>
              <span className="px-2 py-1 rounded-md border border-line bg-panel font-mono text-brand2">
                BTL
              </span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-mut/70 border-t border-line/50 mt-12">
          Verifi runs every test through the BTL runtime
          (<span className="font-mono">/v1/chat/completions</span>). Multi-model
          routing · live cost telemetry · exact-cache savings on reruns.
        </footer>
      </body>
    </html>
  );
}
