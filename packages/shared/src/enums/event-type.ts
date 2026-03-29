export enum EventType {
  TaskCreated = "task.created",
  TaskStateChanged = "task.state.changed",
  ApprovalApproved = "approval.approved",
  ApprovalRejected = "approval.rejected",
  JobQueued = "job.queued",
  JobStarted = "job.started",
  JobCompleted = "job.completed",
  JobFailed = "job.failed",
  ArtifactCreated = "artifact.created",
}
