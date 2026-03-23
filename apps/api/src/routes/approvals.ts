// Approvals routes — GET /approvals, POST /approvals/:id/approve, POST /approvals/:id/reject
import { Router } from "express";
import { z } from "zod";
import { ApprovalState, APPROVAL_TRANSITIONS } from "@bloks/shared";

export const approvalsRouter = Router();

// ── Placeholder store ─────────────────────────────────────────────────────────

const PLACEHOLDER_APPROVALS = [
  {
    id: "appr_001",
    taskId: "task_003",
    projectId: "proj_001",
    title: "UI 컴포넌트 구현 검토 요청",
    state: ApprovalState.WaitingL2,
    approvalLevel: "L2",
    requesterId: "char_002",
    approverId: null as string | null,
    reasonCode: null as string | null,
    comment: null as string | null,
    createdAt: new Date("2026-03-20T09:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-20T09:00:00Z").toISOString(),
  },
  {
    id: "appr_002",
    taskId: "task_004",
    projectId: "proj_002",
    title: "경쟁사 분석 리포트 최종 승인",
    state: ApprovalState.WaitingFounder,
    approvalLevel: "Founder",
    requesterId: "char_003",
    approverId: null as string | null,
    reasonCode: null as string | null,
    comment: null as string | null,
    createdAt: new Date("2026-03-22T11:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-22T11:00:00Z").toISOString(),
  },
  {
    id: "appr_003",
    taskId: "task_001",
    projectId: "proj_001",
    title: "PRD 초안 승인",
    state: ApprovalState.Approved,
    approvalLevel: "L2",
    requesterId: "char_001",
    approverId: "founder-dev" as string | null,
    reasonCode: "APPROVED_AS_IS" as string | null,
    comment: "잘 작성되었습니다." as string | null,
    createdAt: new Date("2026-03-10T08:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-10T10:00:00Z").toISOString(),
  },
];

// ── Pending states helper ─────────────────────────────────────────────────────

const PENDING_STATES: ApprovalState[] = [
  ApprovalState.WaitingL1,
  ApprovalState.WaitingL2,
  ApprovalState.WaitingL3,
  ApprovalState.WaitingFounder,
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  state: z.nativeEnum(ApprovalState).optional(),
  projectId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const approveSchema = z.object({
  reasonCode: z.string().min(1),
  comment: z.string().max(2000).optional(),
});

const rejectSchema = z.object({
  reasonCode: z.string().min(1),
  comment: z.string().min(1).max(2000),
});

// ── GET /approvals ────────────────────────────────────────────────────────────

approvalsRouter.get("/", (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { state, projectId, limit, offset } = parsed.data;
  let results = [...PLACEHOLDER_APPROVALS];

  if (state)     results = results.filter((a) => a.state === state);
  if (projectId) results = results.filter((a) => a.projectId === projectId);

  const total = results.length;
  const page = results.slice(offset, offset + limit);

  res.json({ ok: true, data: { items: page, total, limit, offset } });
});

// ── POST /approvals/:id/approve ───────────────────────────────────────────────

approvalsRouter.post("/:id/approve", (req, res) => {
  const approvalId = req.params["id"];
  const parsed = approveSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "승인 사유 코드가 필요합니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const approval = PLACEHOLDER_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    res.status(404).json({
      ok: false,
      error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
    });
    return;
  }

  if (!PENDING_STATES.includes(approval.state as ApprovalState)) {
    res.status(409).json({
      ok: false,
      error: { code: "APPROVAL_ALREADY_RESOLVED", message: "이미 처리된 결재 건입니다.", details: { state: approval.state } },
    });
    return;
  }

  const allowed = APPROVAL_TRANSITIONS[approval.state as ApprovalState];
  if (!allowed.includes(ApprovalState.Approved)) {
    // escalate to next level instead
    const nextState = allowed.find((s) => s.startsWith("Waiting")) ?? ApprovalState.Approved;
    approval.state = nextState;
  } else {
    approval.state = ApprovalState.Approved;
  }

  approval.approverId = req.auth?.sub ?? "unknown";
  approval.reasonCode = parsed.data.reasonCode;
  approval.comment = parsed.data.comment ?? null;
  approval.updatedAt = new Date().toISOString();

  res.json({ ok: true, data: approval });
});

// ── POST /approvals/:id/reject ────────────────────────────────────────────────

approvalsRouter.post("/:id/reject", (req, res) => {
  const approvalId = req.params["id"];
  const parsed = rejectSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "반려 사유와 코멘트가 필요합니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const approval = PLACEHOLDER_APPROVALS.find((a) => a.id === approvalId);
  if (!approval) {
    res.status(404).json({
      ok: false,
      error: { code: "APPROVAL_NOT_FOUND", message: "결재 건을 찾을 수 없습니다.", details: { approvalId } },
    });
    return;
  }

  if (!PENDING_STATES.includes(approval.state as ApprovalState)) {
    res.status(409).json({
      ok: false,
      error: { code: "APPROVAL_ALREADY_RESOLVED", message: "이미 처리된 결재 건입니다.", details: { state: approval.state } },
    });
    return;
  }

  approval.state = ApprovalState.Rejected;
  approval.approverId = req.auth?.sub ?? "unknown";
  approval.reasonCode = parsed.data.reasonCode;
  approval.comment = parsed.data.comment;
  approval.updatedAt = new Date().toISOString();

  res.json({ ok: true, data: approval });
});
