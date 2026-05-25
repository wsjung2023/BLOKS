#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const DEMO_DIR = join(ROOT, "tools", "demo", "reports");
const OUT_ROOT = join(ROOT, "tools", "reports", "capability-packs");

function nowIso() {
  return new Date().toISOString();
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function write(path, content) {
  writeFileSync(path, content, "utf-8");
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

function parseAiText(aiOutput) {
  if (!aiOutput) return "";
  if (typeof aiOutput === "string") {
    try {
      const parsed = JSON.parse(aiOutput);
      if (typeof parsed?.text === "string") return parsed.text;
      return aiOutput;
    } catch {
      return aiOutput;
    }
  }
  if (typeof aiOutput?.text === "string") return aiOutput.text;
  return "";
}

function pickTaskText(result, keywords) {
  if (!result?.tasks) return "";
  const task = result.tasks.find((t) => keywords.some((k) => String(t.title || "").includes(k)));
  return task ? parseAiText(task.aiOutput) : "";
}

function copyIfExists(src, dst) {
  if (existsSync(src)) {
    copyFileSync(src, dst);
    return true;
  }
  return false;
}

function runCommand(command, cwd = ROOT) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const out = spawnSync(cmd, args, {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    ok: out.status === 0,
    status: out.status ?? 1,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const packArg = args.find((a) => a.startsWith("--pack="));
  const briefArg = args.find((a) => a.startsWith("--brief="));
  if (!packArg) {
    console.error("Usage: node tools/capability-packs/run-pack.mjs --pack=<pack-id> [--brief=<text>]");
    process.exit(1);
  }
  return {
    packId: packArg.slice("--pack=".length),
    brief: briefArg ? briefArg.slice("--brief=".length) : "BLOKS capability pack execution",
  };
}

const homepage = () => readJson(join(DEMO_DIR, "homepage-result.json"));
const ppt = () => readJson(join(DEMO_DIR, "ppt-result.json"));
const program = () => readJson(join(DEMO_DIR, "program-result.json"));

function buildResearch(outDir, brief) {
  const h = homepage();
  const prd = pickTaskText(h, ["PRD", "요구사항"]);
  const arch = pickTaskText(h, ["아키텍처", "기술"]);
  const reportMd = `# Research Report\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n- Source Scenario: homepage-result.json\n\n## PRD Findings\n\n${prd || "(no PRD output found)"}\n\n## Architecture Findings\n\n${arch || "(no architecture output found)"}\n`;
  const reportJson = {
    generatedAt: nowIso(),
    brief,
    source: "homepage-result.json",
    projectId: h?.projectId ?? null,
    taskCount: h?.tasks?.length ?? 0,
    sections: {
      prd: Boolean(prd),
      architecture: Boolean(arch),
    },
  };
  write(join(outDir, "report.md"), reportMd);
  write(join(outDir, "report.json"), JSON.stringify(reportJson, null, 2));
}

function buildMarketing(outDir, brief) {
  const h = homepage();
  const ux = pickTaskText(h, ["UX", "와이어프레임"]);
  const design = pickTaskText(h, ["디자인", "콘셉트"]);
  const campaign = `# Campaign Plan\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n- Source: homepage scenario outputs\n\n## UX Strategy\n\n${ux || "(no UX output found)"}\n`;
  const copy = `# Copy Pack\n\n## Design/Brand Messaging\n\n${design || "(no design output found)"}\n`;
  write(join(outDir, "campaign-plan.md"), campaign);
  write(join(outDir, "copy-pack.md"), copy);
}

function buildProposal(outDir, brief) {
  const p = ppt();
  const execSum = pickTaskText(p, ["Executive", "Summary", "최종"]);
  const market = pickTaskText(p, ["시장", "경쟁사"]);
  const proposalMd = `# Proposal\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n- Source Scenario: ppt-result.json\n\n## Executive Summary\n\n${execSum || "(no executive summary output found)"}\n\n## Market Evidence\n\n${market || "(no market output found)"}\n`;
  write(join(outDir, "proposal.md"), proposalMd);

  const pptCandidates = [
    join(DEMO_DIR, "ppt-result.pptx"),
    join(DEMO_DIR, "ppt-result-bloks.pptx"),
  ];
  const copied = pptCandidates.some((src) => copyIfExists(src, join(outDir, "proposal.pptx")));
  if (!copied) {
    write(join(outDir, "proposal.pptx"), `PPTX placeholder generated at ${nowIso()}\n`);
  }
}

function buildProgramDev(outDir, brief) {
  const p = program();
  const srcDir = join(outDir, "source-code");
  ensureDir(srcDir);

  const progOutDir = join(DEMO_DIR, "program-output");
  const copied = [];
  if (existsSync(progOutDir)) {
    for (const name of readdirSync(progOutDir)) {
      const lower = name.toLowerCase();
      if (lower.endsWith(".py") || lower.endsWith(".html") || lower.endsWith(".js") || lower.endsWith(".ts") || lower.endsWith(".css") || lower.endsWith(".sql")) {
        const src = join(progOutDir, name);
        const dst = join(srcDir, name);
        copyFileSync(src, dst);
        copied.push(name);
      }
    }
  }

  const doneCount = (p?.tasks ?? []).filter((t) => ["Done", "Approved", "InReview"].includes(String(t.state))).length;
  const testReport = {
    generatedAt: nowIso(),
    brief,
    source: "program-result.json",
    copiedFiles: copied,
    copiedFileCount: copied.length,
    scenarioTaskCount: p?.tasks?.length ?? 0,
    doneLikeCount: doneCount,
  };
  write(join(outDir, "test-report.json"), JSON.stringify(testReport, null, 2));
}

function buildPcMaintenance(outDir, brief) {
  const doctorPath = join(outDir, "doctor-report.json");
  const cmd = `pnpm bloks-os doctor --export=${doctorPath}`;
  const res = runCommand(cmd);
  const log = {
    generatedAt: nowIso(),
    brief,
    command: cmd,
    ok: res.ok,
    status: res.status,
    stdoutTail: res.stdout.split("\n").slice(-20).join("\n"),
    stderrTail: res.stderr.split("\n").slice(-20).join("\n"),
  };
  write(join(outDir, "maintenance-log.json"), JSON.stringify(log, null, 2));
  if (!existsSync(doctorPath)) {
    write(doctorPath, JSON.stringify({ generatedAt: nowIso(), ok: false, note: "doctor export missing" }, null, 2));
  }
}

function buildMedia(outDir, brief) {
  const h = homepage();
  const htmlSource = join(DEMO_DIR, "homepage-output", "index.html");
  const storyboard = `# Video Storyboard\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n\n## Scene Sequence\n1. Virtual office opening\n2. Task assignment flow\n3. Audit + analytics reveal\n\n## Source Scenario\n- homepage-result.json (projectId: ${h?.projectId ?? "n/a"})\n`;
  const imageBrief = `# Image Brief\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n\n## Visual Direction\n- Deep dark background + neon accent\n- Isometric office interactions\n- Operator dashboard overlays\n`;
  write(join(outDir, "video-storyboard.md"), storyboard);
  write(join(outDir, "image-brief.md"), imageBrief);

  if (existsSync(htmlSource)) {
    copyFileSync(htmlSource, join(outDir, "homepage-reference.html"));
  }
}

function buildErpOps(outDir, brief) {
  const h = homepage();
  const p = program();
  const kpi = `# KPI Report\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n\n## KPI Snapshot\n- Homepage scenario tasks: ${h?.tasks?.length ?? 0}\n- Program scenario tasks: ${p?.tasks?.length ?? 0}\n- Program done-like tasks: ${(p?.tasks ?? []).filter((t) => ["Done", "Approved", "InReview"].includes(String(t.state))).length}\n`;
  const board = {
    generatedAt: nowIso(),
    lanes: ["Backlog", "Todo", "InProgress", "InReview", "Done"],
    metrics: {
      homepageTasks: h?.tasks?.length ?? 0,
      programTasks: p?.tasks?.length ?? 0,
      programDoneLike: (p?.tasks ?? []).filter((t) => ["Done", "Approved", "InReview"].includes(String(t.state))).length,
    },
    sourceScenarios: ["homepage-result.json", "program-result.json"],
  };
  write(join(outDir, "kpi-report.md"), kpi);
  write(join(outDir, "ops-board.json"), JSON.stringify(board, null, 2));
}

function buildSapAbap(outDir, brief) {
  const p = program();
  const designSource = pickTaskText(p, ["시스템 설계", "설계 문서"]);
  const design = `# ABAP Design\n\n- Generated: ${nowIso()}\n- Brief: ${brief}\n- Source Scenario: program-result.json\n\n## Reused Design Context\n\n${designSource || "(no design output found)"}\n`;
  const abap = `REPORT zbloks_pack.\nPARAMETERS: p_brief TYPE string.\nSTART-OF-SELECTION.\n  WRITE: / 'BLOKS SAP ABAP PACK'.\n  WRITE: / p_brief.\n`;
  write(join(outDir, "abap-design.md"), design);
  write(join(outDir, "abap-code.abap"), abap);
}

const builders = {
  "research-report": buildResearch,
  "marketing-planning": buildMarketing,
  "proposal-doc-output": buildProposal,
  "program-development": buildProgramDev,
  "pc-maintenance": buildPcMaintenance,
  "media-production": buildMedia,
  "erp-project-ops": buildErpOps,
  "sap-abap": buildSapAbap,
};

function main() {
  const { packId, brief } = parseArgs();
  const builder = builders[packId];
  if (!builder) {
    console.error(`Unknown pack: ${packId}`);
    process.exit(1);
  }

  const outDir = join(OUT_ROOT, packId);
  ensureDir(outDir);
  builder(outDir, brief);

  const manifest = {
    packId,
    brief,
    generatedAt: nowIso(),
    outDir,
    sourceReports: [
      join(DEMO_DIR, "homepage-result.json"),
      join(DEMO_DIR, "ppt-result.json"),
      join(DEMO_DIR, "program-result.json"),
    ],
  };
  write(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`[capability-pack] ${packId} generated -> ${outDir}`);
}

main();
