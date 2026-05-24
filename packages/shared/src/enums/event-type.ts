export enum EventType {
  // ── Task / Job / Approval ──────────────────────────────────────────────────
  TaskCreated = "task.created",
  TaskStateChanged = "task.state.changed",
  ApprovalApproved = "approval.approved",
  ApprovalRejected = "approval.rejected",
  JobQueued = "job.queued",
  JobStarted = "job.started",
  JobCompleted = "job.completed",
  JobFailed = "job.failed",
  ArtifactCreated = "artifact.created",

  // ── Tool execution lifecycle (BLOKS OS runtime) ───────────────────────────
  ToolRequested = "tool.requested",
  ToolPolicyEvaluated = "tool.policy.evaluated",
  ToolApprovalRequested = "tool.approval.requested",
  ToolApproved = "tool.approved",
  ToolDenied = "tool.denied",
  ToolExecuted = "tool.executed",
  ToolFailed = "tool.failed",
  ToolAuditPersisted = "tool.audit.persisted",
}

/** Risk tier for tool execution policy evaluation */
export type ToolRiskLevel = "L0" | "L1" | "L2" | "L3";
