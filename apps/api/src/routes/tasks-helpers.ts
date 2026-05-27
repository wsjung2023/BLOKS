// tasks-helpers — state machine validation and event log writer for tasks
import type { DbClient } from "@bloks/db";
import { TaskState, TASK_TRANSITIONS } from "@bloks/shared";

// ── State transition validation ────────────────────────────────────────────────

export function isValidTransition(from: TaskState, to: TaskState): boolean {
  const allowed = TASK_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

// ── Blocked / Cancelled are reachable from multiple states ────────────────────
// Per task spec: "any -> Blocked, any -> Cancelled" — override base transitions
const UNIVERSAL_TARGETS = new Set<TaskState>([TaskState.Blocked, TaskState.Cancelled]);

export function isAllowedTransition(from: TaskState, to: TaskState): boolean {
  if (UNIVERSAL_TARGETS.has(to) && from !== TaskState.Done) return true;
  return isValidTransition(from, to);
}

// ── Event log helper ───────────────────────────────────────────────────────────

export interface EventLogPayload {
  entityType: string;
  entityId: string;
  eventType: string;
  previousState: string | null;
  nextState: string;
  changedBy: string;
  reasonCode?: string | null;
  comment?: string | null;
  relatedProjectId?: string | null;
  relatedTaskId?: string | null;
}

export async function writeEventLog(sb: DbClient, payload: EventLogPayload): Promise<void> {
  const { error } = await sb.from("event_logs").insert({
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    event_type: payload.eventType,
    previous_state: payload.previousState,
    next_state: payload.nextState,
    changed_by: payload.changedBy,
    changed_at: new Date().toISOString(),
    reason_code: payload.reasonCode ?? null,
    comment: payload.comment ?? null,
    related_project_id: payload.relatedProjectId ?? null,
    related_task_id: payload.relatedTaskId ?? null,
  });
  if (error) {
    console.error("[event_log] write error", error);
  }
}

// ── Reduce workload on task completion ────────────────────────────────────────

export async function reduceAssigneeWorkload(
  sb: DbClient,
  assigneeCharacterId: string | null | undefined
): Promise<void> {
  if (!assigneeCharacterId) return;
  const { data } = await sb
    .from("character_runtime_states")
    .select("workload_score, current_task_count")
    .eq("character_id", assigneeCharacterId)
    .single();
  if (!data) return;
  await sb.from("character_runtime_states").update({
    workload_score: Math.max(0, (data.workload_score ?? 0) - 10),
    current_task_count: Math.max(0, (data.current_task_count ?? 1) - 1),
    updated_at: new Date().toISOString(),
  }).eq("character_id", assigneeCharacterId);
}
