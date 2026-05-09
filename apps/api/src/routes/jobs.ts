import { Router } from "express";
import { z } from "zod";
import { QUEUE_NAMES } from "@bloks/shared";
import type { JobExecutionRecord } from "@bloks/shared";
import { getSupabase } from "@bloks/db";
import { enqueueJob } from "../queues/registry.js";

export const jobsRouter = Router();

const createJobSchema = z.object({
  queueName: z.enum([
    QUEUE_NAMES.workflowTransitions,
    QUEUE_NAMES.aiActions,
    QUEUE_NAMES.approvals,
    QUEUE_NAMES.artifactPostprocess,
    QUEUE_NAMES.analyticsRollups,
    QUEUE_NAMES.notifications,
  ]),
  payload: z.record(z.string(), z.unknown()).default({}),
  requestedByCharacterId: z.string().optional(),
});

type JobQueuedPayload = {
  queueName?: string;
  jobName?: string;
  status?: string;
  dedupeKey?: string | null;
  traceId?: string | null;
  payload?: Record<string, unknown>;
};

jobsRouter.get("/", async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("event_logs")
      .select("id, entity_id, event_type, changed_by, changed_at, payload")
      .eq("event_type", "job.queued")
      .order("changed_at", { ascending: false })
      .limit(100);

    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Job 로그 조회 중 오류가 발생했습니다." } });
      return;
    }

    const items: JobExecutionRecord[] = (data ?? []).map((row) => {
      const payload = (row.payload ?? {}) as JobQueuedPayload;
      return {
        id: row.entity_id ?? row.id,
        queue_name: payload.queueName ?? "unknown",
        job_name: payload.jobName ?? "job.queued",
        status: (payload.status as JobExecutionRecord["status"] | undefined) ?? "queued",
        dedupe_key: payload.dedupeKey ?? null,
        trace_id: payload.traceId ?? null,
        created_at: row.changed_at,
        updated_at: row.changed_at,
      };
    });

    res.json({ ok: true, data: { items, total: items.length } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});

jobsRouter.post("/", async (req, res) => {
  const parsed = createJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  try {
    const sb = getSupabase();
    const now = new Date().toISOString();
    const actorId = parsed.data.requestedByCharacterId ?? req.auth?.sub ?? "system";
    const jobId = `job_${Date.now()}`;

    const payload: JobQueuedPayload = {
      queueName: parsed.data.queueName,
      jobName: "job.queued",
      status: "queued",
      payload: parsed.data.payload,
      traceId: (req.headers["x-request-id"] as string | undefined) ?? null,
      dedupeKey: null,
    };

    const traceId = (req.header("x-trace-id") || req.header("x-request-id") || null)?.trim() || null;

    const queued = await enqueueJob({
      queueName: parsed.data.queueName,
      payload: {
        input: parsed.data.payload,
        companyId: "default",
        actorId,
      },
      requestedByCharacterId: actorId,
      traceId,
    });

    const { data, error } = await sb
      .from("event_logs")
      .insert({
        entity_type: "job",
        entity_id: jobId,
        event_type: "job.queued",
        previous_state: null,
        next_state: "queued",
        changed_by: actorId,
        changed_at: now,
        reason_code: null,
        comment: null,
        payload,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Job enqueue 처리 중 오류가 발생했습니다." } });
      return;
    }

    res.status(201).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});
