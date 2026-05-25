#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PACK_FILE = join(ROOT, "tools", "capability-packs", "packs.json");
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "capability-packs-acceptance-latest.json");
const PACK_OUT_ROOT = join(ROOT, "tools", "reports", "capability-packs");

const REQUIRED_PACKS = [
  "research-report",
  "marketing-planning",
  "proposal-doc-output",
  "program-development",
  "pc-maintenance",
  "media-production",
  "erp-project-ops",
  "sap-abap",
];

function run(command) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const args = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const out = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf-8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 });
  return {
    ok: out.status === 0,
    status: out.status ?? 1,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
  };
}

function checkPackSchema(pack) {
  const checks = [];
  checks.push({ name: "id", pass: typeof pack.id === "string" && pack.id.length > 0 });
  checks.push({ name: "name", pass: typeof pack.name === "string" && pack.name.length > 0 });
  checks.push({ name: "artifacts", pass: Array.isArray(pack.artifacts) && pack.artifacts.length >= 2 });
  checks.push({ name: "workflow", pass: Array.isArray(pack.workflow) && pack.workflow.length >= 4 });
  checks.push({ name: "entryCommand", pass: typeof pack.entryCommand === "string" && pack.entryCommand.length > 0 });
  return checks;
}

mkdirSync(REPORT_DIR, { recursive: true });

const report = {
  date: new Date().toISOString(),
  pass: false,
  checks: [],
  missingRequiredPacks: [],
  execution: {
    command: "node tools/capability-packs/run-all-packs.mjs",
    ok: false,
    status: null,
    stdoutTail: "",
    stderrTail: "",
  },
};

if (!existsSync(PACK_FILE)) {
  report.checks.push({ name: "packs_file", pass: false, detail: PACK_FILE });
  writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
  console.error(`[capability-packs acceptance] FAIL - missing ${PACK_FILE}`);
  process.exit(1);
}

const json = JSON.parse(readFileSync(PACK_FILE, "utf-8"));
const packs = Array.isArray(json.packs) ? json.packs : [];
report.checks.push({ name: "packs_file", pass: true, detail: PACK_FILE });

for (const id of REQUIRED_PACKS) {
  if (!packs.find((p) => p.id === id)) report.missingRequiredPacks.push(id);
}
report.checks.push({
  name: "required_pack_presence",
  pass: report.missingRequiredPacks.length === 0,
  detail: report.missingRequiredPacks.length === 0 ? "all present" : report.missingRequiredPacks.join(", "),
});

for (const pack of packs) {
  const checks = checkPackSchema(pack);
  for (const c of checks) {
    report.checks.push({ name: `${pack.id}:${c.name}`, pass: c.pass });
  }
}

const execRes = run("node tools/capability-packs/run-all-packs.mjs");
report.execution = {
  command: "node tools/capability-packs/run-all-packs.mjs",
  ok: execRes.ok,
  status: execRes.status,
  stdoutTail: execRes.stdout.split("\n").slice(-20).join("\n"),
  stderrTail: execRes.stderr.split("\n").slice(-20).join("\n"),
};
report.checks.push({ name: "run_all_packs", pass: execRes.ok, detail: `status=${execRes.status}` });

for (const pack of packs) {
  for (const artifact of pack.artifacts ?? []) {
    const artifactPath = join(PACK_OUT_ROOT, pack.id, artifact);
    report.checks.push({
      name: `${pack.id}:artifact:${artifact}`,
      pass: existsSync(artifactPath),
      detail: artifactPath,
    });
  }
  const manifestPath = join(PACK_OUT_ROOT, pack.id, "manifest.json");
  report.checks.push({
    name: `${pack.id}:manifest`,
    pass: existsSync(manifestPath),
    detail: manifestPath,
  });
}

report.pass = report.checks.every((c) => c.pass);
writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");

if (!report.pass) {
  console.error(`[capability-packs acceptance] FAIL - report: ${REPORT_FILE}`);
  process.exit(1);
}

console.log(`[capability-packs acceptance] PASS - report: ${REPORT_FILE}`);
