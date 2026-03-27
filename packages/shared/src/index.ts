// @bloks/shared — barrel export for all shared enums, types, and constants
export * from "./enums/project-state.js";
export * from "./enums/task-state.js";
export * from "./enums/approval-state.js";
export * from "./enums/character-status.js";
export * from "./enums/priority.js";
export * from "./enums/reason-code.js";
export * from "./enums/event-type.js";
export * from "./id-prefix.js";
export * from "./id.js";

// ── API response envelope types ──────────────────────────────────────────────
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
