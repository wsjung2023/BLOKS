import { ID_PREFIX, QUEUE_NAMES } from "@bloks/shared";
import { getRuntimeProfile } from "@bloks/db";

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
  // If provided, used as deterministic BullMQ job ID to prevent duplicate enqueueing.
  // BullMQ skips adding a job whose ID already exists in the queue.
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

const redisConnection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

type QueueLike = {
  add: (name: string, data: QueueJobData, options: { jobId: string }) => Promise<{ id: string }>;
};

// In-memory queue for local profile — stores jobs in-memory; no Redis required.
const inMemoryJobs = new Map<string, { name: string; data: QueueJobData }>();

function makeInMemoryQueue(): QueueLike {
  return {
    add: async (name: string, data: QueueJobData, options: { jobId: string }) => {
      inMemoryJobs.set(options.jobId, { name, data });
      console.log(`[queue:local] enqueued ${name} => ${options.jobId}`);
      return { id: options.jobId };
    },
  };
}

const queues = new Map<QueueName, QueueLike>();

async function getQueue(queueName: QueueName): Promise<QueueLike> {
  const existing = queues.get(queueName);
  if (existing) return existing;

  // Local profile: skip Redis entirely
  if (getRuntimeProfile() === "local") {
    const q = makeInMemoryQueue();
    queues.set(queueName, q);
    return q;
  }

  const { Queue } = await import("bullmq");
  const queue = new Queue(queueName, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    },
  });

  queues.set(queueName, queue);
  return queue;
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
  const queue = await getQueue(params.queueName);
  const timestamp = Date.now();
  // Use idempotencyKey as deterministic job ID when provided.
  // BullMQ will skip adding if the same job ID already exists (pending/active).
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

