// Approvals routes — GET/approve/reject for /api/v1/approvals
import { Router } from "express";
import { z } from "zod";
import { getDb } from "@bloks/db";
import { writeEventLog } from "./tasks-helpers.js";
import { emitWorldEvent } from "./stream.js";

export const approvalsRouter = Router();

// Actual DB state values — "Pending" is the single waiting state for all levels
const DB_PENDING_STATES = ["Pending"] as const;
const DB_STATE = z.enum(["Pending", "Approved", "Rejected", "Escalated", "Withdrawn"]);

// Approval level ordering for chain advancement
const LEVEL_ORDER = ["L0", "L1", "L2", "L3", "Founder"] as const;
type ALevel = (typeof LEVEL_ORDER)[number];
function levelIndex(l: string): number { return LEVEL_ORDER.indexOf(l as ALevel); }

// Priority → max required approval level
function maxLevelForPriority(priority: string | null | undefined): ALevel {
  switch (priority) {
    case "P0": return "Founder";
    case "P1": return "L3";
    case "P2": return "L2";
    case "P3": return "L1";
    case "P4": return "L0";
    default: return "L1";
  }
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  state: DB_STATE.optional(),
  level: z.string().optional(),
  assigneeCharacterId: z.string().optional(),
  projectId: z.string().optional(),
  entityType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const approveSchema = z.object({
  comment: z.string().max(2000).optional(),
  approvedByCharacterId: z.string().optional(),
});

const rejectSchema = z.object({
  reasonCode: z.string().min(1),
  comment: z.string().min(1).max(2000),
  rejectedByCharacterId: z.string().optional(),
});

// Rename actual DB columns to the field names the frontend expects
const SELECT_COLS =
  "id, entity_type:target_type, entity_id:target_id, approval_level:required_level, state, approver_character_id:approver_id, reason_code, comment, created_at, decided_at";

// ── GET /approvals ────────────────────────────────────────────────────────────

approvalsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { state, level, assigneeCharacterId, projectId, entityType, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const sb = getDb();
    let query = sb
      .from("approvals")
      .select(SELECT_COLS, { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (state) query = query.eq("state", state);
    if (level) query = query.eq("required_level", level);
    if (assigneeCharacterId) query = query.eq("approver_id", assigneeCharacterId);
    if (projectId) query = query.eq("target_id", projectId);
    if (entityType) query = query.eq("target_type", entityType);

    // Default: show pending only
    if (!state) query = query.in("state", DB_PENDING_STATES);

    const { data, count, error } = await query;
    if (error) {
      console.error("[approvals] list error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], page, pageSize, total: count ?? 0 } });
  } catch (err) {
    console.error("[approvals] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /approvals/:id/approve ───────────────────────────────────────────────

approvalsRouter.post("/:id/approve", async (req, res) => {
  const approvalId = req.params["id"];
  const parsed = approveSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  try {
    const sb = getDb();
    const { data: approval, error: fetchError } = await sb
      .from("approvals")
      .select("id, state, target_type, target_id, required_level")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      res.status(404).json({
        ok: false,
        error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
      });
      return;
    }

    if (approval.state !== "Pending") {
      res.status(409).json({
        ok: false,
        error: { code: "APPROVAL_ALREADY_RESOLVED", message: "이미 처리된 결재 건입니다.", details: { state: approval.state } },
      });
      return;
    }

    const actor = parsed.data.approvedByCharacterId ?? req.auth?.sub ?? "system";
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await sb
      .from("approvals")
      .update({
        state: "Approved",
        approver_id: actor,
        comment: parsed.data.comment ?? null,
        decided_at: now,
      })
      .eq("id", approvalId)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "결재 업데이트에 실패했습니다." } });
      return;
    }

    await writeEventLog(sb, {
      entityType: "approval", entityId: approvalId, eventType: "approval.approved",
      previousState: approval.state, nextState: "Approved",
      changedBy: actor,
      comment: parsed.data.comment ?? null,
      relatedProjectId: approval.target_type === "project" ? approval.target_id : null,
      relatedTaskId: approval.target_type === "task" ? approval.target_id : null,
    });

    // Multi-level chain: if task requires a higher level, create the next approval record
    if (approval.target_type === "task") {
      const { data: task } = await sb
        .from("tasks")
        .select("priority, ai_output, assignee_character_id")
        .eq("id", approval.target_id)
        .single();

      const currentLevel = approval.required_level as string ?? "L1";
      const maxLevel = maxLevelForPriority(task?.priority as string ?? null);
      const now = new Date().toISOString();

      if (levelIndex(currentLevel) < levelIndex(maxLevel)) {
        // Advance chain: create next level approval
        const nextLevel = LEVEL_ORDER[levelIndex(currentLevel) + 1]!;
        const nextId = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await sb.from("approvals").insert({
          id: nextId,
          target_type: "task",
          target_id: approval.target_id,
          required_level: nextLevel,
          state: "Pending",
          created_at: now,
        });
        emitWorldEvent("approval_resolved", { approvalId, nextApprovalId: nextId, nextLevel, taskId: approval.target_id });
      } else {
        // All levels satisfied — complete the task
        await sb.from("tasks").update({ state: "Done", updated_at: now }).eq("id", approval.target_id);
        emitWorldEvent("task_state_changed", { taskId: approval.target_id, from: "InReview", to: "Done" });
      }
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[approvals] approve exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /approvals/:id/reject ────────────────────────────────────────────────

approvalsRouter.post("/:id/reject", async (req, res) => {
  const approvalId = req.params["id"];
  const parsed = rejectSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "반려 사유와 코멘트가 필요합니다.", details: parsed.error.flatten() },
    });
    return;
  }

  try {
    const sb = getDb();
    const { data: approval, error: fetchError } = await sb
      .from("approvals")
      .select("id, state, target_type, target_id")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      res.status(404).json({
        ok: false,
        error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
      });
      return;
    }

    if (approval.state !== "Pending") {
      res.status(409).json({
        ok: false,
        error: { code: "APPROVAL_ALREADY_RESOLVED", message: "이미 처리된 결재 건입니다.", details: { state: approval.state } },
      });
      return;
    }

    const actor = parsed.data.rejectedByCharacterId ?? req.auth?.sub ?? "system";
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await sb
      .from("approvals")
      .update({
        state: "Rejected",
        approver_id: actor,
        reason_code: parsed.data.reasonCode,
        comment: parsed.data.comment,
        decided_at: now,
      })
      .eq("id", approvalId)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "반려 업데이트에 실패했습니다." } });
      return;
    }

    await writeEventLog(sb, {
      entityType: "approval", entityId: approvalId, eventType: "approval.rejected",
      previousState: approval.state, nextState: "Rejected",
      changedBy: actor,
      reasonCode: parsed.data.reasonCode,
      comment: parsed.data.comment,
      relatedProjectId: approval.target_type === "project" ? approval.target_id : null,
      relatedTaskId: approval.target_type === "task" ? approval.target_id : null,
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[approvals] reject exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
