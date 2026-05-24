import { Router } from "express";
import { apiRuntimeEngine, pendingExecutions } from "../runtime-store.js";

export const runtimeApprovalsRouter = Router();

/**
 * POST /api/v1/runtime/approvals/:executionId/approve
 * Approve a pending L2 tool execution.
 *
 * Body: { approverId }
 */
runtimeApprovalsRouter.post("/:executionId/approve", async (req, res, next) => {
  try {
    const { executionId } = req.params as { executionId: string };
    const { approverId } = req.body as { approverId?: string };

    const execution = pendingExecutions.get(executionId);
    if (!execution) {
      res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: `No pending execution: ${executionId}` },
      });
      return;
    }

    if (!approverId) {
      res.status(400).json({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "approverId is required" },
      });
      return;
    }

    const result = await apiRuntimeEngine.approveExecution(execution, approverId);
    res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/runtime/approvals/:executionId/deny
 * Deny a pending L2 tool execution.
 *
 * Body: { approverId, reason? }
 */
runtimeApprovalsRouter.post("/:executionId/deny", async (req, res) => {
  const { executionId } = req.params as { executionId: string };

  const execution = pendingExecutions.get(executionId);
  if (!execution) {
    res.status(404).json({
      ok: false,
      error: { code: "NOT_FOUND", message: `No pending execution: ${executionId}` },
    });
    return;
  }

  pendingExecutions.delete(executionId);
  res.json({
    ok: true,
    data: { executionId, status: "denied", errorMessage: "Denied by human approver." },
  });
});

/**
 * GET /api/v1/runtime/approvals
 * List all pending executions awaiting approval.
 */
runtimeApprovalsRouter.get("/", (_req, res) => {
  const list = Array.from(pendingExecutions.values());
  res.json({ ok: true, data: list });
});
