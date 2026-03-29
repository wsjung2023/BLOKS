#!/usr/bin/env node
import { spawn } from "node:child_process";

const PORT = Number(process.env.API_SMOKE_PORT ?? 4100);
const BASE = `http://127.0.0.1:${PORT}`;
const AUTH = { Authorization: "Bearer dev-bypass" };
const QUIET = process.argv.includes("--quiet");

function log(message) {
  if (!QUIET) console.log(message);
}

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      // ignore until server is up
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Timed out waiting for /health");
}

async function assertRoute(path, expectedStatuses, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!expectedStatuses.includes(res.status)) {
    const body = await res.text();
    throw new Error(`Unexpected status for ${path}: ${res.status} body=${body.slice(0, 200)}`);
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new Error(`Expected JSON response for ${path}, got content-type=${ct || "<none>"}`);
  }

  const json = await res.json();
  if (typeof json?.ok !== "boolean") {
    throw new Error(`Expected JSON with boolean ok field for ${path}`);
  }

  log(`✓ ${path} -> ${res.status}`);
}

async function main() {
  const server = spawn("pnpm", ["--filter", "api", "exec", "tsx", "src/index.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "test",
      ENABLE_DEV_BYPASS_AUTH: "true",
    },
    stdio: QUIET ? "ignore" : "inherit",
  });

  const cleanup = () => {
    if (!server.killed) server.kill("SIGTERM");
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitForHealth();
    await assertRoute("/health", [200]);
    await assertRoute("/api/v1/tasks?pageSize=1", [200, 500], AUTH);
    await assertRoute("/api/v1/approvals?pageSize=1", [200, 500], AUTH);
    log("API smoke passed");
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(`[api-smoke] ${err.message}`);
  process.exit(1);
});
