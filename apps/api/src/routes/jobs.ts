import { Router } from "express";
import { z } from "zod";
import { EventType, QUEUE_NAMES } from "@bloks/shared";
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

jobsRouter.get("/", async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("event_logs")
      .select("id, event_type, actor_id, payload, severity, created_at")
      .eq("event_type", EventType.JobQueued)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Job 로그 조회 중 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], total: (data ?? []).length } });
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
    const actorId = parsed.data.requestedByCharacterId ?? req.auth?.sub ?? null;
    const { data: company } = await sb.from("companies").select("id").limit(1).maybeSingle();
    const companyId = company?.id;

    if (!companyId) {
      res.status(422).json({
        ok: false,
        error: { code: "COMPANY_NOT_FOUND", message: "기본 회사(company) 데이터가 없습니다. seed를 먼저 실행해 주세요." },
      });
      return;
    }

    const traceId = (req.header("x-trace-id") || req.header("x-request-id") || null)?.trim() || null;

    const queued = await enqueueJob({
      queueName: parsed.data.queueName,
      payload: {
        input: parsed.data.payload,
        companyId,
        actorId,
      },
      requestedByCharacterId: actorId,
      traceId,
    });

    const { data, error } = await sb
      .from("event_logs")
      .insert({
        company_id: companyId,
        event_type: EventType.JobQueued,
        actor_id: actorId,
        target_type: "job",
        target_id: queued.jobId,
        payload: {
          queueName: parsed.data.queueName,
          payload: parsed.data.payload,
          requestedByCharacterId: actorId,
          queuedAt: now,
          traceId,
          bullJobId: queued.bullJobId,
        },
        severity: "INFO",
        created_at: now,
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
