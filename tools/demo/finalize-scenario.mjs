#!/usr/bin/env node
/**
 * Re-polls task completion and updates result JSON for an already-run scenario.
 * Usage: node tools/demo/finalize-scenario.mjs --scenario=homepage
 *
 * Run this after starting the worker and waiting for tasks to complete.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, "reports");

const API_BASE = process.env["BLOKS_API_URL"] ?? "http://localhost:4000";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${process.env["BLOKS_DEV_TOKEN"] ?? "dev-bypass"}`,
  "x-dev-bypass-auth": "1",
};

function parseArgs() {
  const scenarioArg = process.argv.find((a) => a.startsWith("--scenario="));
  if (!scenarioArg) { console.error("Usage: node finalize-scenario.mjs --scenario=homepage|ppt|program"); process.exit(1); }
  return scenarioArg.replace("--scenario=", "");
}

async function apiFetch(method, path, body) {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method, headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const scenario = parseArgs();
  const resultFile = path.join(REPORTS_DIR, `${scenario}-result.json`);
  if (!existsSync(resultFile)) {
    console.error(`Result file not found: ${resultFile}\nRun: pnpm demo:${scenario} first`);
    process.exit(1);
  }

  const result = JSON.parse(readFileSync(resultFile, "utf8"));
  const { projectId } = result;

  console.log(`\nFinalizing: ${result.projectTitle} (${projectId.slice(0, 8)}...)`);

  // Poll until done or 10 min timeout
  const done = new Set(["Done", "Approved"]);
  const timeoutMs = 600_000;
  const start = Date.now();
  let finalTasks = [];

  while (Date.now() - start < timeoutMs) {
    const res = await apiFetch("GET", `/tasks?projectId=${projectId}&pageSize=200`);
    const items = res.data?.items ?? [];
    const taskIds = result.tasks.map((t) => t.id);
    const relevant = items.filter((t) => taskIds.includes(t.id));
    const doneCount = relevant.filter((t) => done.has(t.state)).length;
    const elapsed = Math.round((Date.now() - start) / 1000);

    process.stdout.write(`\r  ${doneCount}/${taskIds.length} done [${elapsed}s]  `);

    if (doneCount >= taskIds.length) {
      console.log();
      finalTasks = relevant;
      break;
    }
    await sleep(5000);
  }

  if (!finalTasks.length) {
    const res = await apiFetch("GET", `/tasks?projectId=${projectId}&pageSize=200`);
    finalTasks = res.data?.items ?? [];
    console.log(`\n[warn] Timeout — ${finalTasks.filter((t) => done.has(t.state)).length}/${result.tasks.length} done`);
  }

  // Collect artifacts
  const artifacts = {};
  const taskIds = finalTasks.map((t) => t.id);
  await Promise.all(taskIds.map(async (taskId) => {
    try {
      const res = await apiFetch("GET", `/artifacts?taskId=${taskId}&limit=10`);
      artifacts[taskId] = res.data?.items ?? [];
    } catch { artifacts[taskId] = []; }
  }));

  // Update result
  const updated = {
    ...result,
    completedAt: new Date().toISOString(),
    tasks: finalTasks.map((t) => ({
      id: t.id,
      title: t.title,
      state: t.state,
      assigneeCharacterId: t.assignee_character_id,
      aiOutput: t.ai_output,
      artifacts: artifacts[t.id] ?? [],
    })),
  };

  writeFileSync(resultFile, JSON.stringify(updated, null, 2));

  const doneCount = updated.tasks.filter((t) => done.has(t.state)).length;
  const totalAI = updated.tasks.filter((t) => t.aiOutput).length;
  console.log(`\n✓ Result updated: ${doneCount}/${updated.tasks.length} done, ${totalAI} with AI output`);
  console.log(`Next: pnpm demo:report --scenario=${scenario}`);
}

main().catch((e) => { console.error("[ERROR]", e.message); process.exit(1); });
