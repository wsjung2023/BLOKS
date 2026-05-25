import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { RuntimeEngine, globalExecutionBus } from "@bloks/agent-runtime";
import { AuditWriter, type AuditEntry } from "@bloks/audit";
import type { ToolExecutionRecord } from "@bloks/shared";

// ── Durable audit log — JSONL file backed ─────────────────────────────────────
// Each entry is written as one JSON line to BLOKS_AUDIT_DIR/audit.jsonl.
// On startup the file is loaded so the in-memory cache is warm.
// Connected mode can swap this for DB persistence in a later wave.

const AUDIT_DIR = process.env["BLOKS_AUDIT_DIR"] ?? join(process.cwd(), ".bloks-audit");
const AUDIT_FILE = join(AUDIT_DIR, "audit.jsonl");

function ensureAuditDir() {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function loadAuditFile(): AuditEntry[] {
  try {
    ensureAuditDir();
    if (!existsSync(AUDIT_FILE)) return [];
    return readFileSync(AUDIT_FILE, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry);
  } catch (err) {
    console.error("[audit] Failed to load audit file:", err);
    return [];
  }
}

function appendAuditFile(entry: AuditEntry) {
  try {
    ensureAuditDir();
    appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    console.error("[audit] Failed to append audit entry:", err);
  }
}

// Warm in-memory cache from durable file on startup
const auditLog: AuditEntry[] = loadAuditFile();
if (auditLog.length > 0) {
  console.info(`[audit] Loaded ${auditLog.length} entries from ${AUDIT_FILE}`);
}

const lastAuditHash = auditLog[auditLog.length - 1]?.hash ?? "genesis";

const apiAuditWriter = new AuditWriter(async (entry) => {
  auditLog.push(entry);
  appendAuditFile(entry);
}, lastAuditHash);

// API-local RuntimeEngine wired to the audit writer
export const apiRuntimeEngine = new RuntimeEngine(apiAuditWriter);

// Pending L2 executions awaiting human approval
export const pendingExecutions = new Map<string, ToolExecutionRecord>();

// Subscribe to bus so pending approvals are tracked
globalExecutionBus.subscribe((event) => {
  if (event.eventType === "tool.approval.requested") {
    pendingExecutions.set(event.payload.execution.id, event.payload.execution);
  }
  if (event.eventType === "tool.approved" || event.eventType === "tool.denied") {
    pendingExecutions.delete(event.payload.execution.id);
  }
});

export function getAuditLog(): AuditEntry[] {
  return auditLog;
}

// ── Emergency kill switch ─────────────────────────────────────────────────────
// When paused, RuntimeEngine refuses all new tool executions.

let executionPaused = false;
let pausedAt: string | null = null;
let pausedReason: string | null = null;

export function isExecutionPaused(): boolean {
  return executionPaused;
}

export function pauseExecution(reason: string): void {
  executionPaused = true;
  pausedAt = new Date().toISOString();
  pausedReason = reason;
  console.warn(`[BLOKS] ⛔ 실행 일시정지: ${reason}`);
}

export function resumeExecution(): void {
  executionPaused = false;
  pausedAt = null;
  pausedReason = null;
  console.info("[BLOKS] ✅ 실행 재개");
}

export function getExecutionPauseState(): {
  paused: boolean;
  pausedAt: string | null;
  reason: string | null;
} {
  return { paused: executionPaused, pausedAt, reason: pausedReason };
}
