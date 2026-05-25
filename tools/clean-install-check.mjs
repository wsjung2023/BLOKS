#!/usr/bin/env node
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ROOT = resolve(__dirname);
const REPORT_DIR = join(ROOT, "tools", "reports");
const REPORT_FILE = join(REPORT_DIR, "clean-install-check-latest.json");

const args = process.argv.slice(2);
const cloneMode = args.includes("--clone");

function run(command, cwd, env = process.env) {
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "bash";
  const cmdArgs = isWin ? ["/d", "/s", "/c", command] : ["-lc", command];
  const start = Date.now();
  const out = spawnSync(cmd, cmdArgs, {
    cwd,
    env,
    encoding: "utf-8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command,
    cwd,
    exitCode: out.status ?? 1,
    elapsedMs: Date.now() - start,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
    ok: out.status === 0,
  };
}

function runGitClone(source, target, cwd) {
  const start = Date.now();
  const out = spawnSync("git", ["clone", "--depth", "1", source, target], {
    cwd,
    encoding: "utf-8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    command: `git clone --depth 1 ${source} ${target}`,
    cwd,
    exitCode: out.status ?? 1,
    elapsedMs: Date.now() - start,
    stdout: out.stdout ?? "",
    stderr: out.stderr ?? "",
    ok: out.status === 0,
  };
}

function hasDirtyWorktree() {
  const out = spawnSync("git", ["status", "--porcelain"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "pipe",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (out.status !== 0) return true;
  return (out.stdout ?? "").trim().length > 0;
}

function copyWorkspace(source, target) {
  cpSync(source, target, {
    recursive: true,
    force: true,
    filter(src) {
      const normalized = src.replace(/\\/g, "/");
      if (normalized.includes("/.git")) return false;
      if (normalized.includes("/node_modules")) return false;
      if (normalized.includes("/.turbo")) return false;
      if (normalized.includes("/dist")) return false;
      if (normalized.includes("/coverage")) return false;
      if (normalized.includes("/playwright-report")) return false;
      if (normalized.includes("/test-results")) return false;
      if (normalized.includes("/archives")) return false;
      return true;
    },
  });
}

function addStep(report, step) {
  report.steps.push({
    command: step.command,
    cwd: step.cwd,
    exitCode: step.exitCode,
    elapsedMs: step.elapsedMs,
    ok: step.ok,
    stdoutTail: step.stdout.split("\n").slice(-20).join("\n"),
    stderrTail: step.stderr.split("\n").slice(-20).join("\n"),
  });
}

function failIf(step, msg) {
  if (!step.ok) {
    const err = new Error(msg);
    err.step = step;
    throw err;
  }
}

async function main() {
  const startedAt = Date.now();
  mkdirSync(REPORT_DIR, { recursive: true });

  const report = {
    date: new Date().toISOString(),
    mode: cloneMode ? "clone" : "no-clone",
    sourceMode: cloneMode ? "git-clone" : "workspace",
    workspace: "",
    pass: false,
    elapsedMs: 0,
    steps: [],
    artifacts: {},
    failure: null,
  };

  try {
    let workdir = ROOT;

    if (cloneMode) {
      const tempBase = mkdtempSync(join(tmpdir(), "bloks-clean-install-"));
      workdir = join(tempBase, "repo");
      if (hasDirtyWorktree()) {
        copyWorkspace(ROOT, workdir);
        report.steps.push({
          command: `copy workspace -> ${workdir}`,
          cwd: ROOT,
          exitCode: 0,
          elapsedMs: 0,
          ok: true,
          stdoutTail: "dirty worktree detected; used workspace copy instead of git clone",
          stderrTail: "",
        });
        report.sourceMode = "workspace-copy";
      } else {
        const cloneStep = runGitClone(ROOT, workdir, ROOT);
        addStep(report, cloneStep);
        failIf(cloneStep, "git clone failed");
        report.sourceMode = "git-clone";
      }
    }

    report.workspace = workdir;

    const installStep = run("pnpm install --frozen-lockfile", workdir);
    addStep(report, installStep);
    failIf(installStep, "pnpm install failed");

    const localFirstStep = run("pnpm acceptance:local-first", workdir);
    addStep(report, localFirstStep);
    failIf(localFirstStep, "local-first acceptance failed");

    const daemonStep = run("node tools/runtime-daemon-audit-acceptance.mjs", workdir);
    addStep(report, daemonStep);
    failIf(daemonStep, "runtime-daemon acceptance failed");

    const doctorPath = "tools/reports/doctor-clean-install.json";
    const doctorStep = run(`pnpm bloks-os doctor --export=${doctorPath}`, workdir);
    addStep(report, doctorStep);
    failIf(doctorStep, "doctor export failed");

    const cliSmokeStep = run("node tools/cli-distribution-smoke.mjs", workdir);
    addStep(report, cliSmokeStep);
    failIf(cliSmokeStep, "cli distribution smoke failed");

    const localReportPath = join(workdir, "tools", "reports", "local-first-acceptance-latest.json");
    const daemonReportPath = join(workdir, "tools", "reports", "runtime-daemon-audit-acceptance-latest.json");
    const doctorReportPath = join(workdir, doctorPath);
    const cliSmokeReportPath = join(workdir, "tools", "reports", "cli-distribution-smoke-latest.json");

    report.artifacts = {
      localFirstReportPath: localReportPath,
      runtimeDaemonReportPath: daemonReportPath,
      doctorReportPath,
      cliSmokeReportPath,
      localFirstReport: JSON.parse(readFileSync(localReportPath, "utf-8")),
      runtimeDaemonReport: JSON.parse(readFileSync(daemonReportPath, "utf-8")),
      doctorReport: JSON.parse(readFileSync(doctorReportPath, "utf-8")),
      cliSmokeReport: JSON.parse(readFileSync(cliSmokeReportPath, "utf-8")),
    };

    report.pass = true;
  } catch (err) {
    report.failure = err instanceof Error ? err.message : String(err);
    if (err && typeof err === "object" && "step" in err) {
      report.failureStep = err.step;
    }
  } finally {
    report.elapsedMs = Date.now() - startedAt;
    writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf-8");
  }

  if (!report.pass) {
    console.error(`[clean-install check] FAIL - report: ${REPORT_FILE}`);
    if (report.failure) console.error(report.failure);
    process.exit(1);
  }

  console.log(`[clean-install check] PASS in ${Math.round(report.elapsedMs / 1000)}s - report: ${REPORT_FILE}`);
}

main();
