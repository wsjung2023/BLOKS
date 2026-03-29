import { Queue } from "bullmq";
import { ID_PREFIX, QUEUE_NAMES } from "@bloks/shared";

export const queueRegistry = Object.freeze([
  QUEUE_NAMES.workflowTransitions,
  QUEUE_NAMES.aiActions,
  QUEUE_NAMES.approvals,
  QUEUE_NAMES.artifactPostprocess,
  QUEUE_NAMES.analyticsRollups,
  QUEUE_NAMES.notifications,
]);

export type QueueName = (typeof queueRegistry)[number];

export type EnqueueJobParams = {
  queueName: QueueName;
  payload: Record<string, unknown>;
  requestedByCharacterId?: string | null;
  traceId?: string | null;
};

export type QueueJobData = {
  queueName: QueueName;
  payload: Record<string, unknown>;
  requestedByCharacterId: string | null;
  queuedAt: string;
  traceId: string | null;
};

const redisConnection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const queues = new Map<QueueName, Queue>();

function getQueue(queueName: QueueName): Queue {
  const existing = queues.get(queueName);
  if (existing) return existing;

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
  };
}

export async function enqueueJob(params: EnqueueJobParams) {
  const queue = getQueue(params.queueName);
  const timestamp = Date.now();
  const jobId = createJobId(timestamp);
  const jobData = buildQueueJobData(params, new Date(timestamp).toISOString());

  const job = await queue.add("execute", jobData, {
    jobId,
  });

  return {
    jobId,
    bullJobId: job.id,
  };
}
