/**
 * BLOKS OS — Local Runtime Daemon
 *
 * Runs WITHOUT Supabase or Redis.
 * Starts the RuntimeEngine with real tool adapters and serves HTTP APIs
 * for tool execution, approval, and audit queries.
 *
 * Profile: local (BLOKS_PROFILE=local)
 * Port:    DAEMON_PORT (default 4001)
 */
import http from "node:http";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RuntimeEngine, globalExecutionBus } from "@bloks/agent-runtime";
import { AuditWriter, type AuditEntry, verifyAuditChain } from "@bloks/audit";
import type { ToolExecutionRecord } from "@bloks/shared";
import { getRuntimeProfile } from "@bloks/db";
import "./tool-adapters.js";

const AUDIT_DIR = process.env["BLOKS_DAEMON_AUDIT_DIR"] ?? join(process.cwd(), ".bloks-daemon-audit");
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
    console.error("[daemon:audit] Failed to load audit file:", err);
    return [];
  }
}

function appendAuditFile(entry: AuditEntry) {
  try {
    ensureAuditDir();
    appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    console.error("[daemon:audit] Failed to append audit entry:", err);
  }
}

const auditLog: AuditEntry[] = loadAuditFile();
const pendingApprovals = new Map<string, ToolExecutionRecord>();

if (auditLog.length > 0) {
  console.info(`[daemon:audit] Loaded ${auditLog.length} entries from ${AUDIT_FILE}`);
}

const lastAuditHash = auditLog[auditLog.length - 1]?.hash ?? "genesis";
const auditWriter = new AuditWriter(async (entry) => {
  auditLog.push(entry);
  appendAuditFile(entry);
}, lastAuditHash);

const engine = new RuntimeEngine(auditWriter);

globalExecutionBus.subscribe((event) => {
  if (event.eventType === "tool.approval.requested") {
    pendingApprovals.set(event.payload.execution.id, event.payload.execution);
  }
  if (event.eventType === "tool.approved" || event.eventType === "tool.denied") {
    pendingApprovals.delete(event.payload.execution.id);
  }
});

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
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  try {
    if (method === "GET" && path === "/health") {
      return json(res, 200, {
        ok: true,
        profile: getRuntimeProfile(),
        tools: ["file.read", "file.write", "git.status", "git.diff", "git.log", "git.commit", "shell.exec", "git.push"],
        uptime: process.uptime(),
      });
    }

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

    if (method === "GET" && path === "/approvals") {
      return json(res, 200, { ok: true, data: Array.from(pendingApprovals.values()) });
    }

    const approveMatch = path.match(/^\/approvals\/(.+)\/approve$/);
    if (method === "POST" && approveMatch) {
      const executionId = approveMatch[1]!;
      const body = await readBody(req) as Record<string, unknown>;
      const execution = pendingApprovals.get(executionId);
      if (!execution) return json(res, 404, { ok: false, error: "No pending execution: " + executionId });
      const result = await engine.approveExecution(execution, (body["approverId"] as string) ?? "human");
      return json(res, 200, { ok: true, data: result });
    }

    const denyMatch = path.match(/^\/approvals\/(.+)\/deny$/);
    if (method === "POST" && denyMatch) {
      const executionId = denyMatch[1]!;
      const execution = pendingApprovals.get(executionId);
      if (!execution) return json(res, 404, { ok: false, error: "No pending execution: " + executionId });
      pendingApprovals.delete(executionId);
      return json(res, 200, { ok: true, data: { executionId, status: "denied" } });
    }

    if (method === "GET" && path === "/audit") {
      const limit = Number(url.searchParams.get("limit") ?? 50);
      return json(res, 200, { ok: true, data: auditLog.slice(-limit), total: auditLog.length });
    }

    if (method === "GET" && path === "/audit/export") {
      const format = (url.searchParams.get("format") ?? "jsonl").toLowerCase();
      if (format === "csv") {
        const header = "id,eventType,recordedAt,toolName,characterId,status,riskLevel,traceId,hash,prevHash";
        const rows = auditLog.map((e) =>
          [
            e.id,
            e.eventType,
            e.recordedAt,
            e.execution.tool_name,
            e.execution.requested_by_character_id,
            e.execution.status,
            e.execution.risk_level ?? "",
            e.execution.trace_id ?? "",
            e.hash,
            e.prevHash,
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        );
        const csv = [header, ...rows].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="daemon-audit-${Date.now()}.csv"`);
        res.end(csv);
        return;
      }

      const jsonl = auditLog.map((e) => JSON.stringify(e)).join("\n");
      res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="daemon-audit-${Date.now()}.jsonl"`);
      res.end(jsonl);
      return;
    }

    if (method === "GET" && path === "/audit/verify") {
      const verify = verifyAuditChain(auditLog);
      return json(res, 200, {
        ok: true,
        data: {
          valid: verify.valid,
          entryCount: auditLog.length,
          ...(verify.firstBrokenIndex !== undefined ? { firstBrokenIndex: verify.firstBrokenIndex } : {}),
        },
      });
    }

    const replayMatch = path.match(/^\/audit\/replay\/(.+)$/);
    if (method === "GET" && replayMatch) {
      const traceId = replayMatch[1]!;
      const events = auditLog
        .filter((e) => e.execution.trace_id === traceId || e.id.includes(traceId))
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

      if (events.length === 0) {
        return json(res, 404, { ok: false, error: `No audit events for traceId ${traceId}` });
      }

      const first = events[0]!;
      const last = events[events.length - 1]!;
      const durationMs = new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime();

      return json(res, 200, {
        ok: true,
        data: {
          traceId,
          toolName: first.execution.tool_name,
          characterId: first.execution.requested_by_character_id,
          startedAt: first.recordedAt,
          completedAt: last.recordedAt,
          durationMs,
          finalStatus: last.execution.status,
          events: events.map((e) => ({
            eventType: e.eventType,
            recordedAt: e.recordedAt,
            status: e.execution.status,
          })),
        },
      });
    }

    json(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error("[daemon] error:", err);
    json(res, 500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

const PORT = Number(process.env["DAEMON_PORT"] ?? 4001);
const profile = getRuntimeProfile();

if (profile !== "local") {
  console.warn("[daemon] Warning: BLOKS_PROFILE is not 'local'. Daemon is designed for local-first mode.");
}

server.listen(PORT, () => {
  console.log(`[BLOKS runtime-daemon] http://localhost:${PORT} - profile: ${profile}`);
  console.log("[BLOKS runtime-daemon] Registered tools:", ["file.read", "file.write", "git.status", "git.diff", "git.log", "git.commit", "shell.exec", "git.push"].join(", "));
});

process.on("SIGINT", () => { server.close(); process.exit(0); });
process.on("SIGTERM", () => { server.close(); process.exit(0); });
