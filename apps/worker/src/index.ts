import { type Job, Worker } from "bullmq";
import { EventType, QUEUE_NAMES } from "@bloks/shared";
import { getSupabase } from "@bloks/db";

import { runQueueHandler, type WorkerJobPayload } from "./handlers.js";
import { WorldTickEngine } from "./tick-engine.js";

const redisConnection = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
};

const queueNames = Object.values(QUEUE_NAMES);

async function writeJobEvent(event: {
  eventType: EventType;
  job: Job;
  queueName: string;
  errorMessage?: string;
}) {
  try {
    const sb = getSupabase();
    const data = event.job.data as WorkerJobPayload;
    const companyId = data.payload?.companyId;

    if (!companyId) {
      console.warn("[worker] Skip event log because companyId is missing", {
        eventType: event.eventType,
        queueName: event.queueName,
        jobId: event.job.id,
      });
      return;
    }

    const actorId = data.payload?.actorId ?? data.requestedByCharacterId ?? null;

    const { error } = await sb.from("event_logs").insert({
      company_id: companyId,
      event_type: event.eventType,
      actor_id: actorId,
      target_type: "job",
      target_id: String(event.job.id),
      payload: {
        queueName: event.queueName,
        traceId: data.traceId ?? null,
        queuedAt: data.queuedAt ?? null,
        processedAt: new Date().toISOString(),
        attemptsMade: event.job.attemptsMade,
        ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
      },
      severity: event.errorMessage ? "ERROR" : "INFO",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[worker] Failed to write event log", {
        eventType: event.eventType,
        queueName: event.queueName,
        jobId: event.job.id,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[worker] Unexpected error while writing event log", {
      eventType: event.eventType,
      queueName: event.queueName,
      jobId: event.job.id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

const workers = queueNames.map((queueName) => {
  const worker = new Worker(
    queueName,
    async (job) => {
      const startedAt = new Date().toISOString();
      console.log(`[worker:${queueName}] processing`, {
        jobId: job.id,
        name: job.name,
        startedAt,
        traceId: (job.data as WorkerJobPayload | undefined)?.traceId ?? null,
      });

      return runQueueHandler(queueName, job.data as WorkerJobPayload);
    },
    { connection: redisConnection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) },
  );

  worker.on("active", (job) => {
    if (!job) return;
    void writeJobEvent({
      eventType: EventType.JobStarted,
      job,
      queueName,
    });
  });

  worker.on("completed", (job) => {
    if (!job) return;

    console.log(`[worker:${queueName}] completed`, {
      jobId: job.id,
      finishedAt: new Date().toISOString(),
    });

    void writeJobEvent({
      eventType: EventType.JobCompleted,
      job,
      queueName,
    });
  });

  worker.on("failed", (job, error) => {
    if (!job) return;

    console.error(`[worker:${queueName}] failed`, {
      jobId: job.id,
      message: error.message,
      finishedAt: new Date().toISOString(),
    });

    void writeJobEvent({
      eventType: EventType.JobFailed,
      job,
      queueName,
      errorMessage: error.message,
    });
  });

  return worker;
});

console.log("[worker] started", {
  queues: queueNames,
  now: new Date().toISOString(),
  concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
});

// Start the world tick engine
const tickEngine = new WorldTickEngine();
tickEngine.start();

async function shutdown(signal: string) {
  console.log(`[worker] shutting down (${signal})`);
  tickEngine.stop();
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
