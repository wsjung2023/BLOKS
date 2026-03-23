// ProjectState enum — all allowed states for a BLOKS Project entity (doc 03)
export enum ProjectState {
  Idea = "Idea",
  Intake = "Intake",
  Qualified = "Qualified",
  ApprovedForPlanning = "ApprovedForPlanning",
  InPlanning = "InPlanning",
  InExecution = "InExecution",
  OnHold = "OnHold",
  Review = "Review",
  Approved = "Approved",
  Released = "Released",
  Archived = "Archived",
  Cancelled = "Cancelled",
}

/** Allowed forward transitions per state (doc 03 section 2.3) */
export const PROJECT_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  [ProjectState.Idea]: [ProjectState.Intake],
  [ProjectState.Intake]: [ProjectState.Qualified, ProjectState.Cancelled],
  [ProjectState.Qualified]: [ProjectState.ApprovedForPlanning, ProjectState.OnHold],
  [ProjectState.ApprovedForPlanning]: [ProjectState.InPlanning],
  [ProjectState.InPlanning]: [ProjectState.InExecution, ProjectState.OnHold],
  [ProjectState.InExecution]: [ProjectState.Review, ProjectState.OnHold],
  [ProjectState.OnHold]: [ProjectState.InPlanning, ProjectState.InExecution, ProjectState.Cancelled],
  [ProjectState.Review]: [ProjectState.Approved, ProjectState.InExecution],
  [ProjectState.Approved]: [ProjectState.Released],
  [ProjectState.Released]: [ProjectState.Archived],
  [ProjectState.Archived]: [],
  [ProjectState.Cancelled]: [],
};
