// Approvals routes — GET/approve/reject for /api/v1/approvals with Supabase
import { Router } from "express";
import { z } from "zod";
import { getSupabase } from "@bloks/db";
import { ApprovalState, APPROVAL_TRANSITIONS } from "@bloks/shared";
import { writeEventLog } from "./tasks-helpers.js";

export const approvalsRouter = Router();

// ── Pending states ────────────────────────────────────────────────────────────

const PENDING_STATES = new Set<ApprovalState>([
  ApprovalState.WaitingL1,
  ApprovalState.WaitingL2,
  ApprovalState.WaitingL3,
  ApprovalState.WaitingFounder,
]);

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  state: z.nativeEnum(ApprovalState).optional(),
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
    const sb = getSupabase();
    let query = sb
      .from("approvals")
      .select("id, entity_type, entity_id, approval_level, state, requested_by_character_id, approver_character_id, summary, reason_code, comment, created_at, updated_at", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (state) query = query.eq("state", state);
    if (level) query = query.eq("approval_level", level);
    if (assigneeCharacterId) query = query.eq("approver_character_id", assigneeCharacterId);
    if (projectId) query = query.eq("project_id", projectId);
    if (entityType) query = query.eq("entity_type", entityType);

    // Default to pending only if no state filter
    if (!state) query = query.in("state", Array.from(PENDING_STATES));

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
    const sb = getSupabase();
    const { data: approval, error: fetchError } = await sb
      .from("approvals")
      .select("id, state, entity_type, entity_id, approval_level, project_id, task_id")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      res.status(404).json({
        ok: false,
        error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
      });
      return;
    }

    if (!PENDING_STATES.has(approval.state as ApprovalState)) {
      res.status(409).json({
        ok: false,
        error: { code: "APPROVAL_ALREADY_RESOLVED", message: "이미 처리된 결재 건입니다.", details: { state: approval.state } },
      });
      return;
    }

    // Determine next approval state — escalate or finalize
    const currentState = approval.state as ApprovalState;
    const allowedNext = APPROVAL_TRANSITIONS[currentState] ?? [];
    const nextState = allowedNext.includes(ApprovalState.Approved)
      ? ApprovalState.Approved
      : (allowedNext.find((s) => s.startsWith("Waiting")) ?? ApprovalState.Approved);

    const actor = parsed.data.approvedByCharacterId ?? req.auth?.sub ?? "system";
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await sb
      .from("approvals")
      .update({
        state: nextState,
        approver_character_id: actor,
        comment: parsed.data.comment ?? null,
        updated_at: now,
      })
      .eq("id", approvalId)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "결재 업데이트에 실패했습니다." } });
      return;
    }

    // If fully approved, update the target task or project state
    if (nextState === ApprovalState.Approved) {
      if (approval.entity_type === "task" && approval.task_id) {
        await sb.from("tasks").update({ state: "Approved", updated_at: now }).eq("id", approval.task_id);
      } else if (approval.entity_type === "project" && approval.project_id) {
        await sb.from("projects").update({ approval_state: "Approved", updated_at: now }).eq("id", approval.project_id);
      }
    }

    await writeEventLog(sb, {
      entityType: "approval", entityId: approvalId, eventType: "approval.approved",
      previousState: currentState, nextState,
      changedBy: actor,
      comment: parsed.data.comment ?? null,
      relatedProjectId: approval.project_id ?? null,
      relatedTaskId: approval.task_id ?? null,
    });

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
    const sb = getSupabase();
    const { data: approval, error: fetchError } = await sb
      .from("approvals")
      .select("id, state, entity_type, entity_id, project_id, task_id")
      .eq("id", approvalId)
      .single();

    if (fetchError || !approval) {
      res.status(404).json({
        ok: false,
        error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
      });
      return;
    }

    if (!PENDING_STATES.has(approval.state as ApprovalState)) {
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
        state: ApprovalState.Rejected,
        approver_character_id: actor,
        reason_code: parsed.data.reasonCode,
        comment: parsed.data.comment,
        updated_at: now,
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
      previousState: approval.state, nextState: ApprovalState.Rejected,
      changedBy: actor,
      reasonCode: parsed.data.reasonCode,
      comment: parsed.data.comment,
      relatedProjectId: approval.project_id ?? null,
      relatedTaskId: approval.task_id ?? null,
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[approvals] reject exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
