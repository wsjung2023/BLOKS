import { Router } from "express";
import type { Request, Response } from "express";
import {
  apiRuntimeEngine,
  isExecutionPaused,
  pauseExecution,
  resumeExecution,
  getExecutionPauseState,
} from "../runtime-store.js";

export const runtimeRouter = Router();

/**
 * POST /api/v1/runtime/execute
 * Submit a tool call request through the policy/approval/execute pipeline.
 *
 * Body: { toolName, input, characterId, taskId?, traceId? }
 * Response: ToolCallResult — status is "executed" | "denied" | "approval_required"
 */
runtimeRouter.post("/execute", async (req: Request, res: Response) => {
  // Kill switch check — refuse all executions while paused
  if (isExecutionPaused()) {
    const state = getExecutionPauseState();
    res.status(503).json({
      ok: false,
      error: {
        code: "EXECUTION_PAUSED",
        message: "모든 툴 실행이 일시정지됩니다. 재개하려면 /runtime/execution/resume 을 호출하세요.",
        pausedAt: state.pausedAt,
        reason: state.reason,
      },
    });
    return;
  }

  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "toolName and characterId are required" },
      });
      return;
    }

    const { toolName, input, characterId, taskId, traceId } = req.body as {
      toolName?: string;
      input?: Record<string, unknown>;
      characterId?: string;
      taskId?: string;
      traceId?: string;
    };

    if (!toolName || !characterId) {
      res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "toolName and characterId are required" },
      });
      return;
    }

    const result = await apiRuntimeEngine.execute({
      toolName,
      input: input ?? {},
      requestedByCharacterId: characterId,
      taskId: taskId ?? null,
      traceId: traceId ?? crypto.randomUUID(),
    });

    res.json({ ok: true, data: result });
  } catch (_err) {
    res.status(500).json({
      ok: false,
      error: { code: "EXECUTION_ERROR", message: "실행 중 오류가 발생했습니다." },
    });
  }
});

/**
 * GET /api/v1/runtime/execution/status
 * 실행 일시정지 상태 조회.
 */
runtimeRouter.get("/execution/status", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getExecutionPauseState() });
});

/**
 * POST /api/v1/runtime/execution/pause
 * 긴급 Kill Switch — 모든 새 툴 실행을 즉시 차단.
 * Body: { reason?: string }
 */
runtimeRouter.post("/execution/pause", (req: Request, res: Response) => {
  const reason = (req.body as { reason?: string }).reason ?? "관리자 긴급 정지";
  pauseExecution(reason);
  res.json({ ok: true, data: { paused: true, reason, pausedAt: getExecutionPauseState().pausedAt } });
});

/**
 * POST /api/v1/runtime/execution/resume
 * 실행 재개 — Kill Switch 해제.
 */
runtimeRouter.post("/execution/resume", (_req: Request, res: Response) => {
  resumeExecution();
  res.json({ ok: true, data: { paused: false } });
});
