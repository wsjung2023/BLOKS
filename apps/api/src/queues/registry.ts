import { ID_PREFIX, QUEUE_NAMES } from "@bloks/shared";

export const queueRegistry = Object.freeze([
  QUEUE_NAMES.workflowTransitions,
  QUEUE_NAMES.aiActions,
  QUEUE_NAMES.approvals,
  QUEUE_NAMES.artifactPostprocess,
  QUEUE_NAMES.analyticsRollups,
  QUEUE_NAMES.notifications,
  QUEUE_NAMES.founderMessage,
  QUEUE_NAMES.orchestrate,
  QUEUE_NAMES.monthlyReport,
]);

export type QueueName = (typeof queueRegistry)[number];

export type EnqueueJobParams = {
  queueName: QueueName;
  payload: Record<string, unknown>;
  requestedByCharacterId?: string | null;
  traceId?: string | null;
  // If provided, used as deterministic job ID to prevent duplicate enqueueing.
  idempotencyKey?: string | null;
};

export type QueueJobData = {
  queueName: QueueName;
  payload: Record<string, unknown>;
  requestedByCharacterId: string | null;
  queuedAt: string;
  traceId: string | null;
  idempotencyKey: string | null;
};

type QueueLike = {
  add: (name: string, data: QueueJobData, options: { jobId: string }) => Promise<{ id: string }>;
};

const inMemoryJobs = new Map<string, { name: string; data: QueueJobData }>();

const queues = new Map<QueueName, QueueLike>();

function getQueue(queueName: QueueName): QueueLike {
  const existing = queues.get(queueName);
  if (existing) return existing;
  const q: QueueLike = {
    add: async (name, data, options) => {
      inMemoryJobs.set(options.jobId, { name, data });
      console.log(`[queue] enqueued ${name} => ${options.jobId}`);
      return { id: options.jobId };
    },
  };
  queues.set(queueName, q);
  return q;
}

export function createJobId(nowMs = Date.now(), randomSuffix = Math.random().toString(36).slice(2, 8)): string {
  return `${ID_PREFIX.job}${nowMs}_${randomSuffix}`;
}

export function buildQueueJobData(params: EnqueueJobParams, queuedAtIso: string): QueueJobData {
  return {
    queueName: params.queueName,
    payload: params.payload,
    requestedByCharacterId: params.requestedByCharacterId ?? null,
    queuedAt: queuedAtIso,
    traceId: params.traceId ?? null,
    idempotencyKey: params.idempotencyKey ?? null,
  };
}

export async function enqueueJob(params: EnqueueJobParams) {
  const queue = getQueue(params.queueName);
  const timestamp = Date.now();
  // Use idempotencyKey as deterministic job ID when provided.
  const jobId = params.idempotencyKey
    ? `${ID_PREFIX.job}idem_${params.idempotencyKey}`
    : createJobId(timestamp);
  const jobData = buildQueueJobData(params, new Date(timestamp).toISOString());

  const job = await queue.add("execute", jobData, {
    jobId,
  });

  return {
    jobId,
    bullJobId: job.id,
  };
}

