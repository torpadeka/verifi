import { NextRequest } from "next/server";
import { getRun, subscribe } from "@/lib/store";
import type { RunEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return new Response("not found", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (e: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // replay everything that already happened
      for (const e of run.events) send(e);

      // if run already finished, close after replay
      if (run.status === "done" || run.status === "error") {
        controller.close();
        return;
      }

      const unsub = subscribe(id, (e) => {
        send(e);
        if (e.type === "done" || e.type === "error") {
          closed = true;
          unsub();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      });

      // heartbeat so proxies don't kill the connection
      const hb = setInterval(() => {
        if (closed) {
          clearInterval(hb);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(hb);
        }
      }, 15000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
