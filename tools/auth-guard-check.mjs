#!/usr/bin/env node
import { spawn } from "node:child_process";

const PORT = Number(process.env.AUTH_GUARD_PORT ?? 4300);
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Timed out waiting for API");
}

async function main() {
  const server = spawn("pnpm", ["--filter", "api", "exec", "tsx", "src/index.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      JWT_SECRET: "prod-test-secret",
      ENABLE_DEV_BYPASS_AUTH: "true",
    },
    stdio: "ignore",
  });

  const cleanup = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.on("exit", cleanup);

  try {
    await waitForHealth();
    const res = await fetch(`${BASE}/api/v1/tasks?pageSize=1`, {
      headers: { Authorization: "Bearer dev-bypass" },
    });
    const body = await res.json();

    if (res.status !== 401) {
      throw new Error(`Expected 401 when using dev-bypass in production, got ${res.status}`);
    }
    if (body?.error?.code !== "INVALID_TOKEN") {
      throw new Error(`Expected INVALID_TOKEN code, got ${body?.error?.code ?? "<none>"}`);
    }

    console.log("[auth-guard-check] PASS: dev-bypass blocked in production");
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(`[auth-guard-check] ${err.message}`);
  process.exit(1);
});
