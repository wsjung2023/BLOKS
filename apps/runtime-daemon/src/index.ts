/**
 * BLOKS OS — Local Runtime Daemon
 *
 * Runs WITHOUT Supabase or Redis.
 * Starts the RuntimeEngine with real tool adapters and serves a minimal
 * HTTP API for tool execution, approval, and audit queries.
 *
 * Profile: local (BLOKS_PROFILE=local or no SUPABASE_URL)
 * Port:    DAEMON_PORT (default 4001)
 */
import http from "node:http";
import { RuntimeEngine, globalExecutionBus } from "@bloks/agent-runtime";
import { AuditWriter, type AuditEntry } from "@bloks/audit";
import type { ToolExecutionRecord } from "@bloks/shared";
import { getRuntimeProfile } from "@bloks/db";
import "./tool-adapters.js";

// ── Audit store (append-only, in-memory; Wave 4 → flat file in Wave 5+) ──
const auditLog: AuditEntry[] = [];
const pendingApprovals = new Map<string, ToolExecutionRecord>();

const auditWriter = new AuditWriter(async (entry) => {
  auditLog.push(entry);
});

const engine = new RuntimeEngine(auditWriter);

// Track L2 approval requests
globalExecutionBus.subscribe((event) => {
  if (event.eventType === "tool.approval.requested") {
    pendingApprovals.set(event.payload.execution.id, event.payload.execution);
  }
  if (event.eventType === "tool.approved" || event.eventType === "tool.denied") {
    pendingApprovals.delete(event.payload.execution.id);
  }
});

// ── Minimal HTTP server ────────────────────────────────────────────────────

function json(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c: Buffer) => { raw += c.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost`);
  const path = url.pathname;
  const method = req.method ?? "GET";

  try {
    // GET /health
    if (method === "GET" && path === "/health") {
      return json(res, 200, { ok: true, profile: getRuntimeProfile(), tools: Array.from({ length: 0 }), uptime: process.uptime() });
    }

    // POST /execute
    if (method === "POST" && path === "/execute") {
      const body = await readBody(req) as Record<string, unknown>;
      const { toolName, input, characterId, taskId, traceId } = body;
      if (!toolName || !characterId) {
        return json(res, 400, { ok: false, error: "toolName and characterId are required" });
      }
      const result = await engine.execute({
        toolName: toolName as string,
        input: (input as Record<string, unknown>) ?? {},
        requestedByCharacterId: characterId as string,
        taskId: (taskId as string | null | undefined) ?? null,
        traceId: (traceId as string | undefined) ?? crypto.randomUUID(),
      });
      return json(res, 200, { ok: true, data: result });
    }

    // GET /approvals
    if (method === "GET" && path === "/approvals") {
      return json(res, 200, { ok: true, data: Array.from(pendingApprovals.values()) });
    }

    // POST /approvals/:id/approve
    const approveMatch = path.match(/^\/approvals\/(.+)\/approve$/);
    if (method === "POST" && approveMatch) {
      const executionId = approveMatch[1]!;
      const body = await readBody(req) as Record<string, unknown>;
      const execution = pendingApprovals.get(executionId);
      if (!execution) return json(res, 404, { ok: false, error: "No pending execution: " + executionId });
      const result = await engine.approveExecution(execution, (body["approverId"] as string) ?? "human");
      return json(res, 200, { ok: true, data: result });
    }

    // POST /approvals/:id/deny
    const denyMatch = path.match(/^\/approvals\/(.+)\/deny$/);
    if (method === "POST" && denyMatch) {
      const executionId = denyMatch[1]!;
      const execution = pendingApprovals.get(executionId);
      if (!execution) return json(res, 404, { ok: false, error: "No pending execution: " + executionId });
      pendingApprovals.delete(executionId);
      return json(res, 200, { ok: true, data: { executionId, status: "denied" } });
    }

    // GET /audit
    if (method === "GET" && path === "/audit") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      return json(res, 200, { ok: true, data: auditLog.slice(-limit), total: auditLog.length });
    }

    json(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error("[daemon] error:", err);
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────

const PORT = Number(process.env["DAEMON_PORT"] ?? 4001);
const profile = getRuntimeProfile();

if (profile !== "local") {
  console.warn("[daemon] Warning: BLOKS_PROFILE is not 'local'. Daemon is designed for local-first mode.");
}

server.listen(PORT, () => {
  console.log(`[BLOKS runtime-daemon] http://localhost:${PORT} — profile: ${profile}`);
  console.log("[BLOKS runtime-daemon] Registered tools:", ["file.read", "file.write", "git.status", "git.diff", "git.log", "git.commit", "shell.exec", "git.push"].join(", "));
});

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
