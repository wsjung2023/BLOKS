#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "ga-gate-latest.json");

function run(command) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const startedAt = Date.now();
  const out = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 });
  return {
    command,
    ok: out.status === 0,
    exitCode: out.status ?? 1,
    elapsedMs: Date.now() - startedAt,
    stdoutTail: (out.stdout ?? "").split("\n").slice(-20).join("\n"),
    stderrTail: (out.stderr ?? "").split("\n").slice(-20).join("\n"),
  };
}

const suite = [
  "pnpm --filter @bloks/db lint",
  "pnpm --filter api lint",
  "pnpm --filter runtime-daemon lint",
  "pnpm --filter api test -- runtime-audit",
  "pnpm --filter web exec playwright test e2e/smoke.spec.ts",
  "pnpm acceptance:local-first",
  "node tools/runtime-daemon-audit-acceptance.mjs",
  "pnpm acceptance:capability-packs",
  "pnpm distribution:cli-smoke",
];

const report = {
  date: new Date().toISOString(),
  pass: false,
  elapsedMs: 0,
  checks: [],
};

const allStart = Date.now();
mkdirSync(REPORT_DIR, { recursive: true });

for (const command of suite) {
  const res = run(command);
  report.checks.push(res);
  if (!res.ok) {
    report.elapsedMs = Date.now() - allStart;
    report.pass = false;
    writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
    console.error(`[ga-gate] FAIL on: ${command} - report: ${REPORT_FILE}`);
    process.exit(1);
  }
}

report.elapsedMs = Date.now() - allStart;
report.pass = true;
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
console.log(`[ga-gate] PASS in ${Math.round(report.elapsedMs / 1000)}s - report: ${REPORT_FILE}`);
