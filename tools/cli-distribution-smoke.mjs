#!/usr/bin/env node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "cli-distribution-smoke-latest.json");

function run(command, cwd) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const start = Date.now();
  const out = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command,
    cwd,
    ok: out.status === 0,
    exitCode: out.status ?? 1,
    elapsedMs: Date.now() - start,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
  };
}

mkdirSync(REPORT_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), "bloks-cli-smoke-"));
const cliDir = join(ROOT, "tools", "cli");

const report = {
  date: new Date().toISOString(),
  pass: false,
  workspace: tmp,
  steps: [],
  failure: null,
};

try {
  const packStep = run("npm pack", cliDir);
  report.steps.push({ ...packStep, stdoutTail: packStep.stdout.split("\n").slice(-20).join("\n"), stderrTail: packStep.stderr.split("\n").slice(-20).join("\n") });
  if (!packStep.ok) throw new Error("npm pack failed");

  const lines = packStep.stdout.trim().split(/\r?\n/).filter(Boolean);
  const tgz = lines[lines.length - 1];
  const tgzPath = join(cliDir, tgz);

  const initStep = run("npm init -y", tmp);
  report.steps.push({ ...initStep, stdoutTail: initStep.stdout.split("\n").slice(-20).join("\n"), stderrTail: initStep.stderr.split("\n").slice(-20).join("\n") });
  if (!initStep.ok) throw new Error("npm init failed");

  const installStep = run(`npm install ${tgzPath}`, tmp);
  report.steps.push({ ...installStep, stdoutTail: installStep.stdout.split("\n").slice(-20).join("\n"), stderrTail: installStep.stderr.split("\n").slice(-20).join("\n") });
  if (!installStep.ok) throw new Error("npm install tgz failed");

  const helpStep = run("npx --yes bloks-os --help", tmp);
  report.steps.push({ ...helpStep, stdoutTail: helpStep.stdout.split("\n").slice(-20).join("\n"), stderrTail: helpStep.stderr.split("\n").slice(-20).join("\n") });
  if (!helpStep.ok) throw new Error("npx bloks-os --help failed");

  report.pass = true;
} catch (err) {
  report.failure = err instanceof Error ? err.message : String(err);
} finally {
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
  rmSync(tmp, { recursive: true, force: true });
}

if (!report.pass) {
  console.error(`[cli distribution smoke] FAIL - report: ${REPORT_FILE}`);
  if (report.failure) console.error(report.failure);
  process.exit(1);
}

console.log(`[cli distribution smoke] PASS - report: ${REPORT_FILE}`);
