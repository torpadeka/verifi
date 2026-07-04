// Playwright-backed browser controller. Exposes a compact, LLM-friendly view of
// the page (a numbered list of interactive elements + a screenshot) and executes
// actions against those elements by a stable ref id.

import { promises as fs } from "fs";
import path from "path";
import { chromium, type Browser, type Page } from "playwright";

export interface ElementDesc {
  ref: number;
  tag: string;
  type: string; // role/type hint
  name: string; // best-effort accessible name
  editable: boolean;
}

export interface Snapshot {
  url: string;
  title: string;
  elements: ElementDesc[];
  screenshot: string; // public web path
  text: string; // trimmed visible text (context for planner)
}

const TAG_SCRIPT = `(() => {
  const out = [];
  let i = 0;
  const sel = 'a,button,input,textarea,select,[role=button],[role=link],[role=tab],[role=checkbox],[role=menuitem],[onclick],summary,label';
  const nodes = Array.from(document.querySelectorAll(sel));
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const visible = r.width > 2 && r.height > 2 && style.visibility !== 'hidden' && style.display !== 'none' && r.bottom > 0 && r.top < (window.innerHeight + 600);
    if (!visible) continue;
    el.setAttribute('data-verifi-ref', String(i));
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || el.getAttribute('role') || tag).toLowerCase();
    const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.getAttribute('value') || (el.innerText || el.textContent || '').trim().slice(0, 80) || el.getAttribute('title') || '';
    const editable = tag === 'input' || tag === 'textarea' || el.isContentEditable;
    out.push({ ref: i, tag, type, name: label.replace(/\\s+/g, ' ').trim(), editable });
    i++;
    if (i >= 45) break;
  }
  const bodyText = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 2500);
  return { elements: out, title: document.title, url: location.href, text: bodyText };
})()`;

export class BrowserAgent {
  private browser!: Browser;
  private page!: Page;
  private shotDir: string;
  private webBase: string;
  private counter = 0;
  private consoleErrs: string[] = [];
  private networkErrs: string[] = [];

  constructor(private runId: string) {
    // Screenshots live under .data (NOT public/) so runtime writes don't trip the
    // Next.js dev file-watcher; they're served back through /api/shot/<id>/<file>.
    this.shotDir = path.join(process.cwd(), ".data", "runs", runId);
    this.webBase = `/api/shot/${runId}`;
  }

  async start() {
    await fs.mkdir(this.shotDir, { recursive: true });
    this.browser = await chromium.launch({ headless: true });
    const ctx = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 Verifi-QA",
    });
    this.page = await ctx.newPage();
    this.page.setDefaultTimeout(12000);
    this.attachDiagnostics();
  }

  // Listen for the runtime signals a screenshot can't show: JS errors and failed
  // network calls. Buffers are reset per test so each test carries only its own.
  private attachDiagnostics() {
    const push = (arr: string[], msg: string) => {
      if (arr.length < 60 && !arr.includes(msg)) arr.push(msg);
    };
    this.page.on("console", (m) => {
      if (m.type() === "error") push(this.consoleErrs, m.text().slice(0, 240));
    });
    this.page.on("pageerror", (e) =>
      push(this.consoleErrs, `Uncaught ${String(e.message).slice(0, 240)}`)
    );
    this.page.on("requestfailed", (r) => {
      const f = r.failure()?.errorText || "failed";
      // ignore benign aborts (e.g. navigation-cancelled prefetches)
      if (/ABORTED|ERR_ABORTED/i.test(f)) return;
      push(this.networkErrs, `${r.method()} ${r.url().slice(0, 160)} — ${f}`);
    });
    this.page.on("response", (res) => {
      const s = res.status();
      if (s >= 400) push(this.networkErrs, `${s} ${res.request().method()} ${res.url().slice(0, 160)}`);
    });
  }

  resetDiagnostics() {
    this.consoleErrs = [];
    this.networkErrs = [];
  }

  getDiagnostics(): { console: string[]; network: string[] } {
    return {
      console: this.consoleErrs.slice(0, 15),
      network: this.networkErrs.slice(0, 15),
    };
  }

  async goto(url: string) {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await this.settle();
  }

  private async settle() {
    try {
      await this.page.waitForLoadState("networkidle", { timeout: 4000 });
    } catch {
      /* fine — many apps never go idle */
    }
    await this.page.waitForTimeout(400);
  }

  async snapshot(label: string): Promise<Snapshot> {
    let data: any;
    try {
      data = await this.page.evaluate(TAG_SCRIPT);
    } catch {
      data = { elements: [], title: "", url: this.page.url(), text: "" };
    }
    const shot = await this.screenshot(label);
    return {
      url: data.url,
      title: data.title,
      elements: data.elements,
      screenshot: shot,
      text: data.text,
    };
  }

  async screenshot(label: string): Promise<string> {
    const name = `${String(this.counter++).padStart(2, "0")}-${label}.png`.replace(
      /[^a-z0-9.\-]/gi,
      "_"
    );
    const file = path.join(this.shotDir, name);
    try {
      await this.page.screenshot({ path: file, fullPage: false });
    } catch {
      return "";
    }
    return `${this.webBase}/${name}`;
  }

  async dataUrlOf(webPath: string): Promise<string | null> {
    try {
      // webPath is /api/shot/<id>/<file> -> .data/runs/<id>/<file>
      const rel = webPath.replace(/^\/api\/shot\//, "");
      const file = path.join(process.cwd(), ".data", "runs", rel);
      const buf = await fs.readFile(file);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      return null;
    }
  }

  private locator(ref: number) {
    return this.page.locator(`[data-verifi-ref="${ref}"]`).first();
  }

  async click(ref: number): Promise<string> {
    const loc = this.locator(ref);
    const desc = (await loc.textContent().catch(() => "")) || String(ref);
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await loc.click({ timeout: 8000 });
    await this.settle();
    return `clicked "${desc.trim().slice(0, 40)}"`;
  }

  async type(ref: number, value: string): Promise<string> {
    const loc = this.locator(ref);
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await loc.click({ timeout: 8000 }).catch(() => {});
    await loc.fill("").catch(() => {});
    await loc.fill(value, { timeout: 8000 });
    return `typed "${value.slice(0, 30)}"`;
  }

  async press(key: string): Promise<string> {
    await this.page.keyboard.press(key || "Enter");
    await this.settle();
    return `pressed ${key || "Enter"}`;
  }

  async scroll(): Promise<string> {
    await this.page.mouse.wheel(0, 700);
    await this.page.waitForTimeout(350);
    return "scrolled down";
  }

  async gotoUrl(url: string): Promise<string> {
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await this.settle();
    return `navigated to ${url}`;
  }

  currentUrl() {
    return this.page.url();
  }

  async assertText(needle: string): Promise<{ ok: boolean; note: string }> {
    const body = (await this.page.textContent("body").catch(() => "")) || "";
    const ok = body.toLowerCase().includes(needle.toLowerCase());
    return {
      ok,
      note: ok ? `found "${needle}" on page` : `did NOT find "${needle}" on page`,
    };
  }

  async close() {
    try {
      await this.browser?.close();
    } catch {
      /* ignore */
    }
  }
}
