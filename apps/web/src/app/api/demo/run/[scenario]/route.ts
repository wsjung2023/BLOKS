import { spawn } from "node:child_process";
import path from "node:path";

const VALID = new Set(["homepage", "ppt", "program"]);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ scenario: string }> }
) {
  const { scenario } = await params;

  if (!VALID.has(scenario)) {
    return new Response("Unknown scenario", { status: 400 });
  }

  const scriptPath = path.resolve(process.cwd(), "../../tools/demo/run-scenario.mjs");
  const cwd = path.resolve(process.cwd(), "../../");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("node", [scriptPath, `--scenario=${scenario}`], {
        cwd,
        env: { ...process.env },
      });

      const push = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      child.stdout.on("data", (d: Buffer) => push(d.toString()));
      child.stderr.on("data", (d: Buffer) => push(`[stderr] ${d.toString()}`));

      child.on("close", (code) => {
        push(`\n__EXIT__:${code ?? 0}`);
        controller.close();
      });

      child.on("error", (err) => {
        push(`\n__ERROR__: ${err.message}`);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
