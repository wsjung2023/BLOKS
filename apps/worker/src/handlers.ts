import { QUEUE_NAMES } from "@bloks/shared";

type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export type WorkerJobPayload = {
  queueName?: string;
  payload?: {
    input?: Record<string, unknown>;
    companyId?: string | null;
    actorId?: string | null;
  };
  requestedByCharacterId?: string | null;
  queuedAt?: string;
  traceId?: string | null;
};

export type WorkerHandlerResult = {
  ok: true;
  handler: QueueName;
  processedAt: string;
  summary: string;
};

async function processWorkflowTransitions(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.workflowTransitions,
    processedAt: new Date().toISOString(),
    summary: "workflow transition processed",
  };
}

async function processAiActions(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.aiActions,
    processedAt: new Date().toISOString(),
    summary: "ai action processed",
  };
}

async function processApprovals(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.approvals,
    processedAt: new Date().toISOString(),
    summary: "approval pipeline processed",
  };
}

async function processArtifactPostprocess(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.artifactPostprocess,
    processedAt: new Date().toISOString(),
    summary: "artifact postprocess completed",
  };
}

async function processAnalyticsRollups(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.analyticsRollups,
    processedAt: new Date().toISOString(),
    summary: "analytics rollup completed",
  };
}

async function processNotifications(): Promise<WorkerHandlerResult> {
  return {
    ok: true,
    handler: QUEUE_NAMES.notifications,
    processedAt: new Date().toISOString(),
    summary: "notification dispatched",
  };
}

const handlerMap: Record<QueueName, () => Promise<WorkerHandlerResult>> = {
  [QUEUE_NAMES.workflowTransitions]: processWorkflowTransitions,
  [QUEUE_NAMES.aiActions]: processAiActions,
  [QUEUE_NAMES.approvals]: processApprovals,
  [QUEUE_NAMES.artifactPostprocess]: processArtifactPostprocess,
  [QUEUE_NAMES.analyticsRollups]: processAnalyticsRollups,
  [QUEUE_NAMES.notifications]: processNotifications,
};

export async function runQueueHandler(queueName: QueueName, _jobData: WorkerJobPayload): Promise<WorkerHandlerResult> {
  const handler = handlerMap[queueName];
  if (!handler) {
    throw new Error(`No handler registered for queue: ${queueName}`);
  }

  return handler();
}
