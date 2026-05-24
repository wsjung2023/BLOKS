export interface CharacterRuntimeStateRecord {
  activity_status: string;
  workload_score: number;
  fatigue_score: number;
  burnout_triggered: boolean;
  current_task_count?: number;
}

export interface EventLogRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  previous_state?: string | null;
  next_state?: string | null;
  changed_by?: string | null;
  changed_at: string;
  reason_code?: string | null;
  comment?: string | null;
  related_project_id?: string | null;
  related_task_id?: string | null;
}

export interface JobExecutionRecord {
  id: string;
  queue_name: string;
  job_name: string;
  status: "queued" | "active" | "completed" | "failed";
  dedupe_key?: string | null;
  trace_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Canonical record for a single tool execution lifecycle.
 * Emitted at each stage: ToolRequested → PolicyEvaluated → Approved/Denied → Executed/Failed → AuditPersisted
 */
export interface ToolExecutionRecord {
  id: string;                          // idempotency key, unique per tool call
  trace_id: string;                    // links to parent job/task trace
  tool_name: string;                   // e.g. "file.write", "shell.exec", "git.commit"
  risk_level: "L0" | "L1" | "L2" | "L3";
  status: "requested" | "policy_evaluated" | "approval_requested" | "approved" | "denied" | "executed" | "failed" | "audit_persisted";
  input: Record<string, unknown>;      // tool arguments
  output?: Record<string, unknown>;   // tool result (present after execution)
  policy_decision?: "allow" | "deny" | "require_approval";
  approver_id?: string | null;         // character or user who approved
  error_message?: string | null;
  requested_by_character_id: string;
  task_id?: string | null;
  requested_at: string;
  resolved_at?: string | null;
}

/**
 * Payload shape for Tool* events emitted on the Execution Bus / SSE stream.
 */
export interface ToolEventPayload {
  execution: ToolExecutionRecord;
}
