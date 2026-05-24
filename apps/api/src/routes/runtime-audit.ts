import { Router } from "express";
import type { Request, Response } from "express";
import { getAuditLog } from "../runtime-store.js";
import { verifyAuditChain } from "@bloks/audit";

export const runtimeAuditRouter = Router();

/**
 * GET /api/v1/runtime/audit
 * Query the in-memory audit log for tool execution lifecycle events.
 *
 * Query params:
 *   executionId — filter by execution ID prefix
 *   characterId — filter by requestedByCharacterId
 *   toolName    — filter by tool_name
 *   limit       — max entries to return (default 50)
 */
runtimeAuditRouter.get("/", (req, res) => {
  const { executionId, characterId, toolName, limit } = req.query as {
    executionId?: string;
    characterId?: string;
    toolName?: string;
    limit?: string;
  };

  const maxEntries = Math.min(Number(limit ?? 50), 200);

  const entries = getAuditLog()
    .filter((e) => {
      if (executionId && !e.id.includes(executionId)) return false;
      if (characterId && e.execution.requested_by_character_id !== characterId) return false;
      if (toolName && e.execution.tool_name !== toolName) return false;
      return true;
    })
    .slice(-maxEntries);

  res.json({ ok: true, data: entries, total: entries.length });
});

/**
 * GET /api/v1/runtime/audit/export?format=jsonl|csv
 * 전체 감사 로그를 JSONL 또는 CSV 형식으로 다운로드.
 * Compliance export — 05-security-and-governance 요건.
 */
runtimeAuditRouter.get("/export", (req: Request, res: Response) => {
  const format = (req.query["format"] as string | undefined)?.toLowerCase() ?? "jsonl";
  const entries = getAuditLog();

  if (format === "csv") {
    const header = "id,eventType,recordedAt,toolName,characterId,status,riskLevel,traceId,hash,prevHash";
    const rows = entries.map((e) =>
      [
        e.id,
        e.eventType,
        e.recordedAt,
        e.execution.tool_name,
        e.execution.requested_by_character_id,
        e.execution.status,
        e.execution.risk_level ?? "",
        e.execution.trace_id ?? "",
        (e as unknown as Record<string, unknown>)["hash"] ?? "",
        (e as unknown as Record<string, unknown>)["prevHash"] ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="bloks-audit-${Date.now()}.csv"`);
    res.send(csv);
    return;
  }

  // Default: JSONL — one JSON object per line
  const jsonl = entries.map((e) => JSON.stringify(e)).join("\n");
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="bloks-audit-${Date.now()}.jsonl"`);
  res.send(jsonl);
});

/**
 * GET /api/v1/runtime/audit/verify
 * 감사 체인 무결성 검증 — hash-linked chain tamper check.
 */
runtimeAuditRouter.get("/verify", (_req: Request, res: Response) => {
  const entries = getAuditLog() as Parameters<typeof verifyAuditChain>[0];
  const result = verifyAuditChain(entries);
  res.json({
    ok: true,
    data: {
      valid: result.valid,
      entryCount: entries.length,
      ...(result.firstBrokenIndex !== undefined
        ? { firstBrokenIndex: result.firstBrokenIndex }
        : {}),
    },
  });
});

/**
 * GET /api/v1/runtime/audit/replay/:traceId
 * traceId로 특정 실행의 전체 라이프사이클 이벤트를 시간순으로 반환.
 * Phase D — execution replay view 용.
 */
runtimeAuditRouter.get("/replay/:traceId", (req, res) => {
  const { traceId } = req.params as { traceId: string };

  const events = getAuditLog()
    .filter((e) => e.execution.trace_id === traceId || e.id.includes(traceId))
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

  if (events.length === 0) {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `traceId ${traceId}에 해당하는 실행 기록이 없습니다.` } });
    return;
  }

  const first = events[0]!;
  const last = events[events.length - 1]!;
  const durationMs = new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime();

  res.json({
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
});
