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
  founderMessage: "founder-message",
  orchestrate: "orchestrate",
  monthlyReport: "monthly-report",
  collabSynthesis: "collab-synthesis",
} as const;
