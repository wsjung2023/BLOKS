// TaskState enum — all allowed states for a BLOKS Task entity (doc 03)
export enum TaskState {
  Draft = "Draft",
  Created = "Created",
  Assigned = "Assigned",
  Accepted = "Accepted",
  InProgress = "InProgress",
  PendingReview = "PendingReview",
  Rejected = "Rejected",
  Rework = "Rework",
  Approved = "Approved",
  Done = "Done",
  Blocked = "Blocked",
  Cancelled = "Cancelled",
}

/** Allowed forward transitions per state (doc 03 section 3.3) */
export const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.Draft]: [TaskState.Created],
  [TaskState.Created]: [TaskState.Assigned],
  [TaskState.Assigned]: [TaskState.Accepted, TaskState.Cancelled],
  [TaskState.Accepted]: [TaskState.InProgress],
  [TaskState.InProgress]: [TaskState.PendingReview, TaskState.Blocked],
  [TaskState.PendingReview]: [TaskState.Approved, TaskState.Rejected],
  [TaskState.Rejected]: [TaskState.Rework],
  [TaskState.Rework]: [TaskState.PendingReview],
  [TaskState.Approved]: [TaskState.Done],
  [TaskState.Done]: [],
  [TaskState.Blocked]: [TaskState.InProgress, TaskState.Cancelled],
  [TaskState.Cancelled]: [],
};
