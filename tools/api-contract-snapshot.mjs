#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const PORT = Number(process.env.API_SNAPSHOT_PORT ?? 4200);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = process.env.API_CONTRACT_OUT ?? "docs/contracts/api-contract-snapshot.json";

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("Timed out waiting for API");
}

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return {
    path,
    status: res.status,
    ok: res.ok,
    contentType: res.headers.get("content-type"),
    body,
  };
}

async function main() {
  const founderEmail = process.env.FOUNDER_EMAIL ?? "founder@example.com";
  const founderPassword = process.env.FOUNDER_PASSWORD ?? "founder-pass";
  const jwtSecret = process.env.JWT_SECRET ?? "dev-session-secret";

  const server = spawn("pnpm", ["--filter", "api", "exec", "tsx", "src/index.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "test",
      ENABLE_DEV_BYPASS_AUTH: "true",
      FOUNDER_EMAIL: founderEmail,
      FOUNDER_PASSWORD: founderPassword,
      JWT_SECRET: jwtSecret,
    },
    stdio: "ignore",
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

    const samples = [];
    samples.push(await request("/health"));

    const login = await request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: founderEmail, password: founderPassword }),
    });
    samples.push(login);

    const token = login.body?.data?.token;
    const auth = token ? { Authorization: `Bearer ${token}` } : { Authorization: "Bearer dev-bypass" };

    for (const path of [
      "/api/v1/characters?pageSize=1",
      "/api/v1/tasks?pageSize=1",
      "/api/v1/approvals?pageSize=1",
      "/api/v1/events?limit=1",
      "/api/v1/jobs",
    ]) {
      samples.push(await request(path, { headers: auth }));
    }

    const output = {
      generatedAt: new Date().toISOString(),
      baseUrl: BASE,
      note: "Snapshot captured in local test mode; DB-backed routes use local-first JSON storage.",
      samples,
    };

    writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`[api-contract-snapshot] wrote ${OUT}`);
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(`[api-contract-snapshot] ${err.message}`);
  process.exit(1);
});
