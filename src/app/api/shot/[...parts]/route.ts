import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves run screenshots from .data/runs/<id>/<file>. Kept out of /public so
// that writing screenshots mid-run doesn't trigger the Next.js dev watcher.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ parts: string[] }> }
) {
  const { parts } = await params;
  // guard against path traversal
  const safe = parts.filter((p) => p && p !== "." && p !== "..");
  if (safe.length < 2) return new Response("bad path", { status: 400 });

  const file = path.join(process.cwd(), ".data", "runs", ...safe);
  try {
    const buf = await fs.readFile(file);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
