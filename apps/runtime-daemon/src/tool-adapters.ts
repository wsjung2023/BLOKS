/**
 * Real tool adapters for the local runtime.
 * Each tool maps to a concrete OS-level capability.
 *
 * Risk tiers (from policy-engine):
 *   L0 — read-only, auto-allow
 *   L1 — scoped write, auto-allow (within workspace)
 *   L2 — system-level, require_approval
 *   L3 — destructive, deny by default
 */
import { readFile, writeFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { globalToolRegistry } from "@bloks/agent-runtime";

const execFileAsync = promisify(execFile);

const SHELL_TIMEOUT_MS = 30_000;

// ── L0: read-only ──────────────────────────────────────────────────────────

globalToolRegistry.register({
  name: "file.read",
  description: "Read the contents of a file at the given path.",
  riskLevel: "L0",
  inputSchema: { path: { type: "string" } },
  execute: async (input) => {
    const path = input["path"] as string;
    const content = await readFile(path, "utf-8");
    const { size } = await stat(path);
    return { content: content.slice(0, 50_000), size, truncated: content.length > 50_000 };
  },
});

globalToolRegistry.register({
  name: "git.status",
  description: "Show the working tree status for the given repo path.",
  riskLevel: "L0",
  inputSchema: { cwd: { type: "string" } },
  execute: async (input) => {
    const { stdout } = await execFileAsync("git", ["status", "--short"], {
      cwd: (input["cwd"] as string | undefined) ?? process.cwd(),
      timeout: SHELL_TIMEOUT_MS,
    });
    return { output: stdout };
  },
});

globalToolRegistry.register({
  name: "git.diff",
  description: "Show staged/unstaged diff for the given repo path.",
  riskLevel: "L0",
  inputSchema: { cwd: { type: "string" }, staged: { type: "boolean" } },
  execute: async (input) => {
    const args = input["staged"] ? ["diff", "--cached"] : ["diff"];
    const { stdout } = await execFileAsync("git", args, {
      cwd: (input["cwd"] as string | undefined) ?? process.cwd(),
      timeout: SHELL_TIMEOUT_MS,
    });
    return { output: stdout.slice(0, 20_000) };
  },
});

globalToolRegistry.register({
  name: "git.log",
  description: "Show recent commits for the given repo path.",
  riskLevel: "L0",
  inputSchema: { cwd: { type: "string" }, n: { type: "number" } },
  execute: async (input) => {
    const n = String((input["n"] as number | undefined) ?? 10);
    const { stdout } = await execFileAsync(
      "git",
      ["log", `--max-count=${n}`, "--oneline"],
      { cwd: (input["cwd"] as string | undefined) ?? process.cwd(), timeout: SHELL_TIMEOUT_MS },
    );
    return { output: stdout };
  },
});

// ── L1: scoped write ──────────────────────────────────────────────────────

globalToolRegistry.register({
  name: "file.write",
  description: "Write content to a file. Overwrites if exists.",
  riskLevel: "L1",
  inputSchema: { path: { type: "string" }, content: { type: "string" } },
  execute: async (input) => {
    const path = input["path"] as string;
    const content = input["content"] as string;
    await writeFile(path, content, "utf-8");
    return { path, bytesWritten: Buffer.byteLength(content) };
  },
});

globalToolRegistry.register({
  name: "git.commit",
  description: "Stage all changes and create a commit with the given message.",
  riskLevel: "L1",
  inputSchema: { cwd: { type: "string" }, message: { type: "string" } },
  execute: async (input) => {
    const cwd = (input["cwd"] as string | undefined) ?? process.cwd();
    await execFileAsync("git", ["add", "-A"], { cwd, timeout: SHELL_TIMEOUT_MS });
    const { stdout } = await execFileAsync(
      "git",
      ["commit", "-m", input["message"] as string],
      { cwd, timeout: SHELL_TIMEOUT_MS },
    );
    return { output: stdout };
  },
});

// ── L2: system-level, require_approval ───────────────────────────────────

globalToolRegistry.register({
  name: "shell.exec",
  description: "Execute an arbitrary shell command. Requires human approval.",
  riskLevel: "L2",
  inputSchema: { command: { type: "string" }, cwd: { type: "string" } },
  execute: async (input) => {
    const command = input["command"] as string;
    const cwd = (input["cwd"] as string | undefined) ?? process.cwd();
    const { stdout, stderr } = await execFileAsync(
      process.platform === "win32" ? "cmd" : "sh",
      process.platform === "win32" ? ["/c", command] : ["-c", command],
      { cwd, timeout: SHELL_TIMEOUT_MS },
    );
    return { stdout: stdout.slice(0, 10_000), stderr: stderr.slice(0, 2_000) };
  },
});

globalToolRegistry.register({
  name: "git.push",
  description: "Push commits to remote. Requires human approval.",
  riskLevel: "L2",
  inputSchema: { cwd: { type: "string" }, remote: { type: "string" }, branch: { type: "string" } },
  execute: async (input) => {
    const cwd = (input["cwd"] as string | undefined) ?? process.cwd();
    const remote = (input["remote"] as string | undefined) ?? "origin";
    const branch = (input["branch"] as string | undefined) ?? "HEAD";
    const { stdout } = await execFileAsync("git", ["push", remote, branch], {
      cwd,
      timeout: SHELL_TIMEOUT_MS,
    });
    return { output: stdout };
  },
});
