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
