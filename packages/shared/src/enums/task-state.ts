// TaskState enum — matches actual DB task_state enum values
export enum TaskState {
  Backlog = "Backlog",
  Todo = "Todo",
  InProgress = "InProgress",
  InReview = "InReview",
  Blocked = "Blocked",
  Done = "Done",
  Cancelled = "Cancelled",
}

/** Allowed forward transitions per state */
export const TASK_TRANSITIONS: Record<TaskState, TaskState[]> = {
  [TaskState.Backlog]: [TaskState.Todo],
  [TaskState.Todo]: [TaskState.InProgress, TaskState.Blocked, TaskState.Cancelled],
  [TaskState.InProgress]: [TaskState.InReview, TaskState.Blocked],
  [TaskState.InReview]: [TaskState.Done, TaskState.Todo],
  [TaskState.Blocked]: [TaskState.Todo, TaskState.Cancelled],
  [TaskState.Done]: [],
  [TaskState.Cancelled]: [],
};
