#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "runtime-daemon-audit-acceptance-latest.json");
const DAEMON_PORT = Number(process.env["BLOKS_DAEMON_ACCEPTANCE_PORT"] ?? 4012);
const DAEMON_BASE = `http://127.0.0.1:${DAEMON_PORT}`;
const DAEMON_AUDIT_DIR = join(REPORT_DIR, "daemon-audit-store");

const result = {
  date: new Date().toISOString(),
  daemonBase: DAEMON_BASE,
  elapsedMs: 0,
  pass: false,
  checks: [],
  artifacts: {},
  failure: null,
};

function addCheck(name, pass, detail = "") {
  result.checks.push({ name, pass, detail, at: new Date().toISOString() });
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${DAEMON_BASE}/health`);
      if (res.ok) return true;
    } catch {
      // waiting
    }
    await sleep(1000);
  }
  return false;
}

function stopProcessTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill("SIGINT");
    }
  } catch {
    try { child.kill("SIGKILL"); } catch { /* ignore */ }
  }
}

async function main() {
  const startedAt = Date.now();
  let daemonProc = null;
  const stdoutTail = [];
  const stderrTail = [];

  try {
    mkdirSync(REPORT_DIR, { recursive: true });
    rmSync(DAEMON_AUDIT_DIR, { recursive: true, force: true });

    const cmd = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm --filter runtime-daemon dev"]
      : ["--filter", "runtime-daemon", "dev"];

    daemonProc = spawn(cmd, args, {
      cwd: ROOT,
      shell: false,
      env: {
        ...process.env,
        BLOKS_PROFILE: "local",
        DAEMON_PORT: String(DAEMON_PORT),
        BLOKS_DAEMON_AUDIT_DIR: DAEMON_AUDIT_DIR,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    daemonProc.stdout?.on("data", (b) => {
      stdoutTail.push(String(b));
      if (stdoutTail.length > 200) stdoutTail.shift();
    });
    daemonProc.stderr?.on("data", (b) => {
      stderrTail.push(String(b));
      if (stderrTail.length > 200) stderrTail.shift();
    });

    const healthy = await waitForHealth();
    addCheck("daemon_health", healthy, healthy ? "daemon /health ok" : "daemon health timeout");
    if (!healthy) throw new Error("daemon health timeout");

    const execRes = await fetch(`${DAEMON_BASE}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolName: "file.read",
        characterId: "founder-dev",
        input: { path: join(ROOT, "README.md") },
      }),
    });
    const execJson = await execRes.json();
    addCheck("daemon_execute", execRes.ok, `status=${execRes.status}`);
    if (!execRes.ok || execJson?.ok !== true) throw new Error(`execute failed: ${execRes.status}`);

    const auditRes = await fetch(`${DAEMON_BASE}/audit?limit=20`);
    const auditJson = await auditRes.json();
    const auditItems = auditJson?.data ?? [];
    addCheck("daemon_audit_query", auditRes.ok && Array.isArray(auditItems) && auditItems.length > 0, `status=${auditRes.status} count=${Array.isArray(auditItems) ? auditItems.length : 0}`);
    if (!auditRes.ok || !Array.isArray(auditItems) || auditItems.length === 0) throw new Error("audit query failed");

    const verifyRes = await fetch(`${DAEMON_BASE}/audit/verify`);
    const verifyJson = await verifyRes.json();
    const valid = verifyJson?.data?.valid === true;
    addCheck("daemon_audit_verify", verifyRes.ok && valid, `status=${verifyRes.status} valid=${String(verifyJson?.data?.valid)}`);
    if (!verifyRes.ok || !valid) throw new Error("audit verify failed");

    const traceId = auditItems[auditItems.length - 1]?.execution?.trace_id;
    const replayRes = await fetch(`${DAEMON_BASE}/audit/replay/${encodeURIComponent(traceId)}`);
    const replayOk = replayRes.ok;
    addCheck("daemon_audit_replay", replayOk, `status=${replayRes.status} traceId=${String(traceId)}`);
    if (!replayOk) throw new Error("audit replay failed");

    const exportRes = await fetch(`${DAEMON_BASE}/audit/export?format=jsonl`);
    addCheck("daemon_audit_export", exportRes.ok, `status=${exportRes.status}`);
    if (!exportRes.ok) throw new Error("audit export failed");

    const auditFile = join(DAEMON_AUDIT_DIR, "audit.jsonl");
    const fileExists = existsSync(auditFile);
    addCheck("daemon_audit_file", fileExists, auditFile);
    if (!fileExists) throw new Error("audit file missing");

    result.artifacts = {
      traceId,
      auditFile,
      reportFile: REPORT_FILE,
    };

    result.elapsedMs = Date.now() - startedAt;
    result.pass = result.checks.every((c) => c.pass);
  } catch (err) {
    result.failure = err instanceof Error ? err.message : String(err);
  } finally {
    result.elapsedMs = result.elapsedMs || (Date.now() - startedAt);
    result.pass = result.pass && !result.failure;
    result.artifacts.daemonStdoutTail = stdoutTail.slice(-30).join("");
    result.artifacts.daemonStderrTail = stderrTail.slice(-30).join("");
    writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2), "utf-8");
    stopProcessTree(daemonProc);
  }

  if (!result.pass) {
    console.error(`[runtime-daemon acceptance] FAIL - report: ${REPORT_FILE}`);
    if (result.failure) console.error(result.failure);
    process.exit(1);
  }

  console.log(`[runtime-daemon acceptance] PASS in ${Math.round(result.elapsedMs / 1000)}s - report: ${REPORT_FILE}`);
}

main();
