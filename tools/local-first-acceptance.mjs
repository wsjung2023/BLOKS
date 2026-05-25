#!/usr/bin/env node
/**
 * Local-first acceptance runner
 *
 * Goal:
 * - Prove first task end-to-end flow without Supabase/Redis signup
 * - Produce reproducible evidence JSON
 *
 * Flow:
 * 1) Boot API in local profile
 * 2) Health check
 * 3) Create project
 * 4) Create task
 * 5) Transition task states to Done
 * 6) Validate audit endpoints (query/verify/export)
 * 7) Validate local JSON persistence file exists
 * 8) Save evidence report
 */

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "local-first-acceptance-latest.json");

const API_PORT = Number(process.env["BLOKS_ACCEPTANCE_PORT"] ?? 4011);
const API_BASE = `http://127.0.0.1:${API_PORT}`;
const AUTH_HEADERS = {
  Authorization: "Bearer dev-bypass",
  "Content-Type": "application/json",
  Accept: "application/json",
};

const result = {
  date: new Date().toISOString(),
  apiBase: API_BASE,
  elapsedMs: 0,
  under10Minutes: false,
  pass: false,
  checks: [],
  artifacts: {},
  failure: null,
};

function addCheck(name, pass, detail = "") {
  result.checks.push({ name, pass, detail, at: new Date().toISOString() });
}

async function sleep(ms) {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function fetchJson(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: AUTH_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-json response (handled by caller)
  }
  return { status: res.status, ok: res.ok, text, json, headers: res.headers };
}

async function waitForHealth(timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return true;
    } catch {
      // server not ready yet
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
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
  }
}

async function main() {
  const startedAt = Date.now();
  let apiProc = null;
  const stdoutLines = [];
  const stderrLines = [];

  try {
    mkdirSync(REPORT_DIR, { recursive: true });

    const spawnCmd = process.platform === "win32" ? "cmd.exe" : "pnpm";
    const spawnArgs = process.platform === "win32"
      ? ["/d", "/s", "/c", "pnpm --filter api dev"]
      : ["--filter", "api", "dev"];
    apiProc = spawn(spawnCmd, spawnArgs, {
      cwd: ROOT,
      env: {
        ...process.env,
        BLOKS_PROFILE: "local",
        ENABLE_DEV_BYPASS_AUTH: "true",
        PORT: String(API_PORT),
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    apiProc.stdout?.on("data", (buf) => {
      const line = String(buf);
      stdoutLines.push(line);
      if (stdoutLines.length > 200) stdoutLines.shift();
    });
    apiProc.stderr?.on("data", (buf) => {
      const line = String(buf);
      stderrLines.push(line);
      if (stderrLines.length > 200) stderrLines.shift();
    });

    const healthy = await waitForHealth();
    addCheck("api_health", healthy, healthy ? "API responded /health" : "API did not become healthy in 90s");
    if (!healthy) throw new Error("API health check failed");

    const projectTitle = `Local-first acceptance ${new Date().toISOString()}`;
    const projectRes = await fetchJson("POST", "/api/v1/projects", {
      title: projectTitle,
      brief: "Acceptance run for local-first first-task proof",
      priority: "High",
    });
    const projectId = projectRes.json?.data?.id ?? projectRes.json?.data?.project?.id ?? null;
    addCheck("project_create", Boolean(projectId), `status=${projectRes.status}`);
    if (!projectId) throw new Error(`Project create failed: ${projectRes.status} ${projectRes.text}`);

    const taskRes = await fetchJson("POST", "/api/v1/tasks", {
      projectId,
      title: "First local-first acceptance task",
      description: "Must transition to Done in local profile",
      taskType: "document",
      priority: "Medium",
    });
    const taskId = taskRes.json?.data?.id ?? taskRes.json?.data?.task?.id ?? null;
    addCheck("task_create", Boolean(taskId), `status=${taskRes.status}`);
    if (!taskId) throw new Error(`Task create failed: ${taskRes.status} ${taskRes.text}`);

    const transitions = ["Todo", "InProgress", "InReview", "Done"];
    for (const nextState of transitions) {
      const tr = await fetchJson("PATCH", `/api/v1/tasks/${taskId}/state`, { nextState });
      addCheck(`task_state_${nextState}`, tr.ok, `status=${tr.status}`);
      if (!tr.ok) throw new Error(`Transition to ${nextState} failed: ${tr.status} ${tr.text}`);
    }

    const taskList = await fetchJson("GET", `/api/v1/tasks?ids=${encodeURIComponent(taskId)}&pageSize=1`);
    const finalState = taskList.json?.data?.items?.[0]?.state ?? null;
    addCheck("task_final_done", finalState === "Done", `finalState=${String(finalState)}`);
    if (finalState !== "Done") throw new Error(`Final task state is not Done: ${String(finalState)}`);

    const auditQuery = await fetchJson("GET", "/api/v1/runtime/audit?limit=20");
    addCheck("audit_query", auditQuery.ok, `status=${auditQuery.status}`);
    if (!auditQuery.ok) throw new Error(`Audit query failed: ${auditQuery.status}`);

    const auditVerify = await fetchJson("GET", "/api/v1/runtime/audit/verify");
    const auditValid = auditVerify.json?.data?.valid === true;
    addCheck("audit_verify", auditVerify.ok && auditValid, `status=${auditVerify.status} valid=${String(auditVerify.json?.data?.valid)}`);
    if (!auditVerify.ok || !auditValid) throw new Error(`Audit verify failed: ${auditVerify.status} ${auditVerify.text}`);

    const auditExport = await fetch(`${API_BASE}/api/v1/runtime/audit/export?format=jsonl`, {
      headers: { Authorization: "Bearer dev-bypass", Accept: "application/x-ndjson,text/plain" },
    });
    addCheck("audit_export_jsonl", auditExport.ok, `status=${auditExport.status}`);
    if (!auditExport.ok) throw new Error(`Audit export failed: ${auditExport.status}`);

    const localDb = join(ROOT, ".bloks-data", "local-db.json");
    const dbExists = existsSync(localDb);
    addCheck("local_db_file", dbExists, dbExists ? localDb : "missing");
    if (!dbExists) throw new Error(`Local DB file missing: ${localDb}`);

    result.artifacts = {
      projectId,
      taskId,
      localDbPath: localDb,
      reportFile: REPORT_FILE,
    };

    result.elapsedMs = Date.now() - startedAt;
    result.under10Minutes = result.elapsedMs <= 10 * 60 * 1000;
    result.pass = result.checks.every((c) => c.pass) && result.under10Minutes;
    if (!result.under10Minutes) {
      addCheck("under_10_minutes", false, `elapsedMs=${result.elapsedMs}`);
    } else {
      addCheck("under_10_minutes", true, `elapsedMs=${result.elapsedMs}`);
    }
  } catch (err) {
    result.failure = err instanceof Error ? err.message : String(err);
  } finally {
    result.elapsedMs = result.elapsedMs || (Date.now() - startedAt);
    if (!result.checks.some((c) => c.name === "under_10_minutes")) {
      result.under10Minutes = result.elapsedMs <= 10 * 60 * 1000;
      addCheck("under_10_minutes", result.under10Minutes, `elapsedMs=${result.elapsedMs}`);
    }
    result.pass = result.pass && !result.failure;
    result.artifacts.apiStdoutTail = stdoutLines.slice(-30).join("");
    result.artifacts.apiStderrTail = stderrLines.slice(-30).join("");
    writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2), "utf-8");
    stopProcessTree(apiProc);
  }

  if (!result.pass) {
    console.error(`[local-first acceptance] FAIL — report: ${REPORT_FILE}`);
    if (result.failure) console.error(result.failure);
    process.exit(1);
  }

  console.log(`[local-first acceptance] PASS in ${Math.round(result.elapsedMs / 1000)}s — report: ${REPORT_FILE}`);
}

main();
