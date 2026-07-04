import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

// DM Sans stands in for PP Radio Grotesk Light (per DESIGN.md substitute list).
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Verifi — AI QA, powered by BTL Runtime",
  description:
    "Point Verifi at any web app. An AI agent explores it in a real browser, writes and runs end-to-end tests, and files bug reports — all on the BTL runtime.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable}`}>
      <body>
        <header className="sticky top-0 z-30 px-5 pt-4">
          <div className="mx-auto max-w-[1120px]">
            <nav className="flex items-center justify-between bg-snow rounded-[32px] px-5 h-14 shadow-subtle">
              <a href="/" className="flex items-center gap-2.5">
                <span className="grid place-items-center w-7 h-7 rounded-full bg-carbon text-snow text-sm font-semibold">
                  V
                </span>
                <span className="font-medium tracking-tight text-carbon">
                  Verifi
                  <span className="text-stone font-normal"> · AI QA</span>
                </span>
              </a>
              <div className="flex items-center gap-4 text-[13px] text-stone">
                <span className="hidden sm:inline">runtime by</span>
                <span className="px-3 py-1 rounded-[100px] bg-fog text-graphite font-medium tracking-tight">
                  BTL
                </span>
              </div>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1120px] px-5 pt-8 pb-6">{children}</main>

        <footer className="mx-auto max-w-[1120px] px-5 py-10 mt-8 text-[13px] text-pebble border-t border-line">
          Verifi runs every test through the BTL runtime
          (<span className="text-graphite">/v1/chat/completions</span>).
          Multi-model routing · live cost telemetry · exact-cache savings on reruns.
        </footer>
      </body>
    </html>
  );
}
