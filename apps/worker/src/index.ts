import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { WorldTickEngine } from "./tick-engine.js";
import "./tools.js";

// Load .env from repo root if present — works without --env-file flag
{
  const __dir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dir, "../../../.env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^([^#\s][^=]*)=(.*)/);
      if (m) process.env[m[1]!.trim()] ??= m[2]!.trim();
    }
  }
}

console.log("[worker] started", { now: new Date().toISOString() });

const tickEngine = new WorldTickEngine();
tickEngine.start();

async function shutdown(signal: string) {
  console.log(`[worker] shutting down (${signal})`);
  tickEngine.stop();
  process.exit(0);
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
