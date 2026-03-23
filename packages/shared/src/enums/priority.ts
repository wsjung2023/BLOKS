// Priority enum — P0 (critical) to P4 (backlog), used across Project and Task (doc 03, 09)
export enum Priority {
  P0 = "P0",
  P1 = "P1",
  P2 = "P2",
  P3 = "P3",
  P4 = "P4",
}

/** SLA baseline mapping (doc 03 section 7.2) */
export const PRIORITY_SLA_LABEL: Record<Priority, string> = {
  [Priority.P0]: "Immediate escalation",
  [Priority.P1]: "Assign same day",
  [Priority.P2]: "Assign within 24h",
  [Priority.P3]: "When resource available",
  [Priority.P4]: "Backlog",
};
