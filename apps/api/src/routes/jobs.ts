import { Router } from "express";
import { z } from "zod";
import { QUEUE_NAMES } from "@bloks/shared";
import type { JobExecutionRecord } from "@bloks/shared";
import { getSupabase, writeEventLog } from "@bloks/db";
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
    QUEUE_NAMES.founderMessage,
    QUEUE_NAMES.orchestrate,
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
    const traceId = req.traceId ?? req.header("x-trace-id") ?? req.header("x-request-id") ?? null;
    const idempotencyKey = req.header("idempotency-key")?.trim() || null;

    // Idempotency check: return existing outbox row if same key already processed
    if (idempotencyKey) {
      const { data: existing } = await sb
        .from("outbox_events")
        .select("id, queue_name")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existing) {
        res.status(200).json({ ok: true, data: { jobId: existing.id, queueName: existing.queue_name, idempotent: true } });
        return;
      }
    }

    // 일일 AI 예산 초과 차단 — aiActions 큐에만 적용
    const AI_MAX_DAILY_COST_USD = parseFloat(process.env["AI_MAX_DAILY_COST_USD"] ?? "5");
    if (parsed.data.queueName === "ai-actions" && AI_MAX_DAILY_COST_USD > 0) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { data: spanRows } = await sb
        .from("event_logs")
        .select("comment")
        .eq("event_type", "ai.span.completed")
        .gte("created_at", todayStart.toISOString());

      let todayCost = 0;
      for (const row of spanRows ?? []) {
        try {
          const span = JSON.parse((row.comment as string) ?? "{}") as Record<string, number>;
          todayCost += span["costUsd"] ?? 0;
        } catch { /* ignore */ }
      }

      if (todayCost >= AI_MAX_DAILY_COST_USD) {
        res.status(429).json({
          ok: false,
          error: {
            code: "DAILY_BUDGET_EXCEEDED",
            message: `오늘 AI 비용(${todayCost.toFixed(4)} USD)이 일일 한도(${AI_MAX_DAILY_COST_USD} USD)를 초과했습니다.`,
            todayCostUsd: todayCost,
            limitUsd: AI_MAX_DAILY_COST_USD,
          },
        });
        return;
      }
    }

    // Insert outbox record first (durability: relay picks it up if BullMQ publish fails)
    const outboxId = `outbox_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const jobPayload = { input: parsed.data.payload, companyId: "default", actorId };

    const { error: outboxError } = await sb.from("outbox_events").insert({
      id: outboxId,
      idempotency_key: idempotencyKey,
      queue_name: parsed.data.queueName,
      payload: jobPayload,
      requested_by_character_id: actorId,
      trace_id: traceId,
    });

    // 23505 = UNIQUE violation: concurrent duplicate, treat as idempotent
    if (outboxError?.code === "23505" && idempotencyKey) {
      const { data: existing } = await sb
        .from("outbox_events")
        .select("id, queue_name")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      res.status(200).json({ ok: true, data: { jobId: existing?.id ?? outboxId, queueName: parsed.data.queueName, idempotent: true } });
      return;
    }
    if (outboxError) {
      console.warn("[jobs] outbox insert failed (non-fatal):", outboxError.message);
    }

    // Enqueue to BullMQ — jobId dedup via idempotencyKey prevents double-processing
    const queued = await enqueueJob({
      queueName: parsed.data.queueName,
      payload: jobPayload,
      requestedByCharacterId: actorId,
      traceId,
      idempotencyKey,
    });

    // Mark outbox row as published (fire-and-forget; relay will retry if this fails)
    void sb.from("outbox_events")
      .update({ published_at: now })
      .eq("id", outboxId)
      .then(({ error }) => { if (error) console.warn("[jobs] outbox mark published failed:", error.message); });

    res.status(201).json({ ok: true, data: { jobId: queued.jobId, queueName: parsed.data.queueName } });

    // Fire-and-forget event log via shared writer
    void writeEventLog(sb, {
      entityType: "job",
      entityId: queued.jobId,
      eventType: "job.queued",
      nextState: "queued",
      changedBy: actorId,
      meta: {
        queueName: parsed.data.queueName,
        jobName: "job.queued",
        status: "queued",
        payload: parsed.data.payload,
        traceId,
        dedupeKey: idempotencyKey,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});
