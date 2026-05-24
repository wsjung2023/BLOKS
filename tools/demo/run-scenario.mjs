#!/usr/bin/env node
/**
 * Demo scenario runner
 * Usage: node tools/demo/run-scenario.mjs --scenario=homepage|ppt|program
 *
 * Flow:
 *  1. Enable AI for participating characters
 *  2. Create project
 *  3. Create tasks with character assignments
 *  4. Write .current-demo.json (Playwright reads this for screenshots)
 *  5. Trigger aiActions jobs for each task
 *  6. Poll until all tasks are Done/Approved (120s timeout)
 *  7. Collect artifacts
 *  8. Save result JSON
 *  9. Disable AI (always, even on error)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, "reports");
const STATE_FILE = path.join(REPORTS_DIR, ".current-demo.json");

const API_BASE = process.env["BLOKS_API_URL"] ?? "http://localhost:4000";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Authorization: `Bearer ${process.env["BLOKS_DEV_TOKEN"] ?? "dev-bypass"}`,
  "x-dev-bypass-auth": "1",
};

// ── helpers ────────────────────────────────────────────────────────────────────

function parseArgs() {
  const scenarioArg = process.argv.find((a) => a.startsWith("--scenario="));
  if (!scenarioArg) {
    console.error("Usage: node run-scenario.mjs --scenario=homepage|ppt|program");
    process.exit(1);
  }
  return scenarioArg.replace("--scenario=", "");
}

async function apiFetch(method, path, body) {
  const url = `${API_BASE}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json?.error ?? json)}`);
  }
  return json;
}

async function loadScenario(name) {
  const file = path.join(__dirname, "scenarios", `${name}.mjs`);
  if (!existsSync(file)) {
    console.error(`Unknown scenario: ${name}. Available: homepage, ppt, program`);
    process.exit(1);
  }
  const mod = await import(`file:///${file.replace(/\\/g, "/")}`);
  return mod[Object.keys(mod)[0]];
}

async function findCharacters(codeNames) {
  let page = 1;
  const found = {};
  while (Object.keys(found).length < codeNames.length) {
    const res = await apiFetch("GET", `/characters?pageSize=100&page=${page}`);
    const items = res.data?.items ?? [];
    for (const item of items) {
      const cn = (item.code_name ?? "").toLowerCase();
      if (codeNames.includes(cn)) found[cn] = { id: item.id, name: item.name };
    }
    if (items.length < 100) break;
    page++;
  }
  const missing = codeNames.filter((cn) => !found[cn]);
  if (missing.length > 0) {
    console.warn(`[warn] Characters not found in DB: ${missing.join(", ")} — tasks will be created without assignee`);
  }
  return found;
}

async function setAiEnabled(characterIds, enabled) {
  const label = enabled ? "ON" : "OFF";
  await Promise.all(
    characterIds.map(async (id) => {
      try {
        await apiFetch("PATCH", `/characters/${id}`, { ai_enabled: enabled });
      } catch (e) {
        console.warn(`[warn] ai_enabled ${label} failed for ${id}: ${e.message}`);
      }
    })
  );
  console.log(`  ✓ AI ${label} for ${characterIds.length} characters`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollTasksUntilDone(projectId, taskIds, timeoutMs = 120_000) {
  const done = new Set(["Done", "Approved", "InReview"]);
  const failed = new Set(["Cancelled"]);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await apiFetch("GET", `/tasks?projectId=${projectId}&pageSize=200`);
    const items = res.data?.items ?? [];
    const relevant = items.filter((t) => taskIds.includes(t.id));

    const doneCount = relevant.filter((t) => done.has(t.state)).length;
    const failCount = relevant.filter((t) => failed.has(t.state)).length;
    const elapsed = Math.round((Date.now() - start) / 1000);

    process.stdout.write(
      `\r  polling... ${doneCount}/${taskIds.length} done, ${failCount} cancelled [${elapsed}s]  `
    );

    if (doneCount + failCount >= taskIds.length) {
      console.log();
      return relevant;
    }

    await sleep(5000);
  }

  console.log();
  console.warn("[warn] Timeout reached — some tasks may not be done yet");
  const res = await apiFetch("GET", `/tasks?projectId=${projectId}&pageSize=200`);
  return (res.data?.items ?? []).filter((t) => taskIds.includes(t.id));
}

async function collectArtifacts(taskIds) {
  const artifacts = {};
  await Promise.all(
    taskIds.map(async (taskId) => {
      try {
        const res = await apiFetch("GET", `/artifacts?taskId=${taskId}&limit=10`);
        artifacts[taskId] = res.data?.items ?? [];
      } catch {
        artifacts[taskId] = [];
      }
    })
  );
  return artifacts;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  const scenarioName = parseArgs();
  console.log(`\n=== BLOKS Demo Scenario: ${scenarioName} ===\n`);

  const scenario = await loadScenario(scenarioName);
  const codeNames = scenario.tasks.map((t) => t.codeName.toLowerCase());
  const uniqueCodeNames = [...new Set(codeNames)];

  mkdirSync(REPORTS_DIR, { recursive: true });

  // 1. Find characters
  console.log("1. Finding characters...");
  const charMap = await findCharacters(uniqueCodeNames);
  const characterIds = Object.values(charMap).map((c) => c.id);
  console.log(`   Found: ${Object.keys(charMap).join(", ")}`);

  // 2. Enable AI
  console.log("2. Enabling AI for scenario characters...");
  await setAiEnabled(characterIds, true);

  let projectId = null;
  const taskIds = [];

  try {
    // 3. Create project
    console.log("3. Creating project...");
    const projectRes = await apiFetch("POST", "/projects", {
      title: scenario.projectTitle,
      brief: scenario.projectBrief,
      priority: scenario.projectPriority,
    });
    projectId = projectRes.data?.id ?? projectRes.data?.project?.id;
    if (!projectId) throw new Error("Project creation returned no ID");
    console.log(`   Project ID: ${projectId}`);

    // 4. Create tasks
    console.log("4. Creating tasks...");
    const taskCreations = await Promise.all(
      scenario.tasks.map(async (taskDef) => {
        const char = charMap[taskDef.codeName.toLowerCase()];
        const body = {
          projectId,
          title: taskDef.title,
          description: taskDef.description ?? "",
          taskType: taskDef.taskType,
          priority: taskDef.priority ?? "Medium",
          assigneeCharacterId: char?.id ?? null,
        };
        const res = await apiFetch("POST", "/tasks", body);
        const task = res.data?.task ?? res.data;
        const taskId = task?.id;
        if (!taskId) throw new Error(`Task creation returned no ID for: ${taskDef.title}`);
        console.log(`   ✓ ${taskDef.title} → ${taskId.slice(0, 8)}...`);
        return { taskId, taskDef, char };
      })
    );
    taskIds.push(...taskCreations.map((t) => t.taskId));

    // 5. Write .current-demo.json for Playwright
    const demoState = {
      scenario: scenarioName,
      projectId,
      projectTitle: scenario.projectTitle,
      characters: Object.entries(charMap).map(([codeName, c]) => ({ name: c.name, codeName })),
      startedAt: new Date().toISOString(),
    };
    writeFileSync(STATE_FILE, JSON.stringify(demoState, null, 2));
    console.log("5. Demo state written → .current-demo.json");
    console.log("   (Run: pnpm demo:capture for initial screenshots now)");

    // 6. Trigger aiActions jobs
    console.log("6. Triggering AI jobs...");
    await Promise.all(
      taskCreations.map(async ({ taskId, char }) => {
        if (!char?.id) {
          console.warn(`   [skip] No character for task ${taskId}`);
          return;
        }
        await apiFetch("POST", "/jobs", {
          queueName: "ai-actions",
          payload: { taskId, characterId: char.id },
          requestedByCharacterId: char.id,
        });
      })
    );
    console.log(`   ✓ ${taskCreations.length} jobs queued`);

    // 7. Poll until done
    console.log("7. Waiting for tasks to complete (max 300s)...");
    const finalTasks = await pollTasksUntilDone(projectId, taskIds, 300_000);

    // 8. Collect artifacts
    console.log("8. Collecting artifacts...");
    const artifacts = await collectArtifacts(taskIds);
    const totalArtifacts = Object.values(artifacts).reduce((s, a) => s + a.length, 0);
    console.log(`   ✓ ${totalArtifacts} artifacts collected`);

    // 9. Save result
    const result = {
      scenario: scenarioName,
      projectId,
      projectTitle: scenario.projectTitle,
      startedAt: demoState.startedAt,
      completedAt: new Date().toISOString(),
      tasks: finalTasks.map((t) => ({
        id: t.id,
        title: t.title,
        state: t.state,
        assigneeCharacterId: t.assignee_character_id,
        aiOutput: t.ai_output,
        artifacts: artifacts[t.id] ?? [],
      })),
      characters: Object.entries(charMap).map(([codeName, c]) => ({ codeName, id: c.id, name: c.name })),
    };

    const resultFile = path.join(REPORTS_DIR, `${scenarioName}-result.json`);
    writeFileSync(resultFile, JSON.stringify(result, null, 2));
    console.log(`\n✓ Result saved → ${resultFile}`);

    // 10. Extract code output files (HTML, Python, etc.)
    const outputDir = path.join(REPORTS_DIR, `${scenarioName}-output`);
    mkdirSync(outputDir, { recursive: true });
    let extractedFiles = 0;
    const CODE_TYPES = [
      { lang: "html",   ext: ".html" },
      { lang: "python", ext: ".py"   },
      { lang: "js",     ext: ".js"   },
      { lang: "ts",     ext: ".ts"   },
      { lang: "css",    ext: ".css"  },
      { lang: "sql",    ext: ".sql"  },
    ];
    for (const task of result.tasks) {
      const raw = task.aiOutput;
      const text = typeof raw === "string"
        ? (() => { try { return JSON.parse(raw)?.text ?? ""; } catch { return ""; } })()
        : (raw?.text ?? raw?.output_text ?? raw?.outputText ?? "");
      if (!text) continue;
      const slug = task.title.replace(/[^a-zA-Z0-9가-힣]/g, "-").replace(/-+/g, "-").toLowerCase();
      for (const { lang, ext } of CODE_TYPES) {
        const re = new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "gi");
        const matches = [...text.matchAll(re)];
        for (let i = 0; i < matches.length; i++) {
          const code = matches[i][1].trim();
          if (code.length < 300) continue; // skip trivial code snippets (inline examples)
          const filename = matches.length > 1 ? `${slug}-${i + 1}${ext}` : `${slug}${ext}`;
          writeFileSync(path.join(outputDir, filename), code);
          console.log(`   ✓ ${lang.toUpperCase()} saved → ${scenarioName}-output/${filename} (${code.length} chars)`);
          extractedFiles++;
        }
      }
    }
    if (extractedFiles === 0) {
      console.log(`   (코드 파일 없음 — 태스크 출력에 코드블록이 없었습니다)`);
    }

    // 11. Generate PPTX
    const pptxGenScript = path.join(__dirname, "..", "pptx-gen", "generate.py");
    const pptxOut = path.join(REPORTS_DIR, `${scenarioName}-result.pptx`);
    if (existsSync(pptxGenScript)) {
      console.log("11. Generating PPTX...");
      const proc = spawnSync("python", [pptxGenScript, "--input", resultFile, "--output", pptxOut, "--style", "consulting"], { encoding: "utf-8" });
      if (proc.status === 0) {
        console.log(`   ✓ PPTX saved → ${scenarioName}-result.pptx`);
      } else {
        console.warn(`   [warn] PPTX generation failed: ${proc.stderr}`);
      }
    }

    const doneCount = finalTasks.filter((t) => ["Done", "Approved", "InReview"].includes(t.state)).length;
    console.log(`\nSummary: ${doneCount}/${taskIds.length} tasks completed`);
    console.log(`Next: pnpm demo:capture  →  takes screenshots`);
    console.log(`      pnpm demo:report --scenario=${scenarioName}  →  generates report`);
  } finally {
    // Always disable AI
    console.log("\n9. Disabling AI for scenario characters...");
    await setAiEnabled(characterIds, false);
  }
}

main().catch((err) => {
  console.error("\n[ERROR]", err.message);
  process.exit(1);
});
