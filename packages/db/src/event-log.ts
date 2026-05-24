// Shared event log writer — single write path for all apps (API, worker)
// Replaces ad-hoc sb.from("event_logs").insert() scattered across the codebase.
import { getSupabase, type SupabaseClient } from './supabase.js';

export interface EventLogPayload {
  entityType: string;
  entityId: string;
  eventType: string;
  previousState?: string | null;
  nextState?: string | null;
  changedBy: string;
  reasonCode?: string | null;
  comment?: string | null;
  relatedProjectId?: string | null;
  relatedTaskId?: string | null;
  severity?: 'INFO' | 'WARN' | 'ERROR';
  /** Extra context — stored in event_logs.payload if column exists, otherwise ignored */
  meta?: Record<string, unknown>;
}

/**
 * Write a single event_logs row.
 * Pass an explicit `sb` client (useful when already inside a request context),
 * or omit to use the singleton getSupabase() (useful in workers).
 */
export async function writeEventLog(
  payloadOrSb: EventLogPayload | SupabaseClient,
  maybePayload?: EventLogPayload,
): Promise<void> {
  let sb: SupabaseClient;
  let payload: EventLogPayload;

  // Overload: (sb, payload) or (payload)
  if (maybePayload !== undefined) {
    sb = payloadOrSb as SupabaseClient;
    payload = maybePayload;
  } else {
    sb = getSupabase();
    payload = payloadOrSb as EventLogPayload;
  }

  const { error } = await sb.from('event_logs').insert({
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    event_type: payload.eventType,
    previous_state: payload.previousState ?? null,
    next_state: payload.nextState ?? null,
    changed_by: payload.changedBy,
    changed_at: new Date().toISOString(),
    reason_code: payload.reasonCode ?? null,
    comment: payload.comment ?? null,
    related_project_id: payload.relatedProjectId ?? null,
    related_task_id: payload.relatedTaskId ?? null,
    severity: payload.severity ?? 'INFO',
    ...(payload.meta !== undefined ? { payload: payload.meta } : {}),
  });

  if (error) {
    console.error('[event_log] write error', error.message);
  }
}
