// @bloks/shared — barrel export for all shared enums, types, and constants
export * from "./enums/project-state.js";
export * from "./enums/task-state.js";
export * from "./enums/approval-state.js";
export * from "./enums/character-status.js";
export * from "./enums/priority.js";
export * from "./enums/reason-code.js";

// ── Shared ID prefix constants (doc 11 P0 fix #4) ───────────────────────────
export const ID_PREFIX = {
  company: "company_",
  character: "char_",
  project: "proj_",
  task: "task_",
  approval: "appr_",
  artifact: "art_",
  event: "evt_",
  job: "job_",
} as const;

// ── Queue names (doc 11 P0 fix #5 — canonical from doc 09) ──────────────────
export const QUEUE_NAMES = {
  workflowTransitions: "workflow-transitions",
  aiActions: "ai-actions",
  approvals: "approvals",
  artifactPostprocess: "artifact-postprocess",
  analyticsRollups: "analytics-rollups",
  notifications: "notifications",
} as const;

// ── API response envelope types ──────────────────────────────────────────────
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
