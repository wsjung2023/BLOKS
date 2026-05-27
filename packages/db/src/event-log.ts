// Shared event log writer — single write path for all apps (API, worker)
import { getDb, type DbClient } from './local-stub.js';

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
 * Pass an explicit `db` client (useful when already inside a request context),
 * or omit to use the singleton getDb() (useful in workers).
 */
export async function writeEventLog(
  payloadOrDb: EventLogPayload | DbClient,
  maybePayload?: EventLogPayload,
): Promise<void> {
  let sb: DbClient;
  let payload: EventLogPayload;

  // Overload: (db, payload) or (payload)
  if (maybePayload !== undefined) {
    sb = payloadOrDb as DbClient;
    payload = maybePayload;
  } else {
    sb = getDb();
    payload = payloadOrDb as EventLogPayload;
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
    console.error('[event_log] write error', (error as { message?: string }).message);
  }
}
