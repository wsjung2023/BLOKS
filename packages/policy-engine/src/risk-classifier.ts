import type { ToolRiskLevel } from "@bloks/shared";

/**
 * Classifies tool risk level based on tool name and input.
 *
 * L0 — read-only, auto-allow
 * L1 — scoped write, pre-approved within workspace
 * L2 — system-level, runtime approval required
 * L3 — destructive/network-sensitive, two-person approval
 */

const L0_TOOLS = new Set([
  "file.read",
  "file.search",
  "git.status",
  "git.diff",
  "git.log",
  "process.inspect",
  "shell.read",
]);

const L1_TOOLS = new Set([
  "file.write",
  "file.patch",
  "file.move",
  "git.commit",
  "git.branch",
]);

const L2_TOOLS = new Set([
  "shell.exec",
  "process.start",
  "process.stop",
  "git.push",
  "git.merge",
  "browser.navigate",
  "browser.click",
  "browser.fill",
]);

// L3 = everything else (destructive shell patterns, network calls, package installs)
const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf/i,
  /drop\s+table/i,
  /format\s+[a-z]:/i,
  /--force/i,
  /sudo/i,
];

export function classifyRisk(
  toolName: string,
  input: Record<string, unknown>,
): ToolRiskLevel {
  if (L0_TOOLS.has(toolName)) return "L0";
  if (L1_TOOLS.has(toolName)) return "L1";
  if (L2_TOOLS.has(toolName)) return "L2";

  // Check shell commands for destructive patterns → L3
  const cmd = String(input["command"] ?? input["cmd"] ?? "");
  if (cmd && DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd))) return "L3";

  return "L3"; // deny-unknown default to highest risk
}
