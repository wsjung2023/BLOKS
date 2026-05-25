import { Router } from "express";
import { z } from "zod";
import { QUEUE_NAMES } from "@bloks/shared";
import type { JobExecutionRecord } from "@bloks/shared";
import { getRuntimeProfile, getSupabase, writeEventLog } from "@bloks/db";
import { routeAI, generateImage, generateVideo } from "@bloks/ai-router";
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

type LocalInlineContext = {
  queueName: string;
  payload: Record<string, unknown>;
  actorId: string;
  traceId: string | null;
};

export async function runLocalInlineJob(ctx: LocalInlineContext): Promise<void> {
  if (ctx.queueName === QUEUE_NAMES.aiActions) {
    await runLocalAiAction(ctx.payload, ctx.actorId, ctx.traceId);
    return;
  }

  if (ctx.queueName === QUEUE_NAMES.orchestrate) {
    await runLocalOrchestrate(ctx.payload, ctx.actorId, ctx.traceId);
    return;
  }
}

async function runLocalOrchestrate(
  payload: Record<string, unknown>,
  actorId: string,
  traceId: string | null,
): Promise<void> {
  const sb = getSupabase();
  const input = (payload["input"] as Record<string, unknown> | undefined) ?? payload;
  const projectId = String(input["projectId"] ?? input["project_id"] ?? "");
  if (!projectId) return;

  const projectTitle = String(input["title"] ?? "Local Project");
  const brief = String(input["brief"] ?? projectTitle);
  const now = new Date().toISOString();

  const VIDEO_KEYWORDS = ["영상", "비디오", "유튜브", "광고영상", "릴스", "쇼츠", "동영상", "클립", "reels", "shorts", "youtube", "video", "광고 영상", "홍보 영상", "소개 영상"];
  const IMAGE_KEYWORDS = ["이미지", "디자인", "포스터", "배너", "그림", "비주얼", "썸네일", "로고", "image", "design", "poster", "banner", "visual", "graphic", "logo", "thumbnail"];
  const isVideoTask = VIDEO_KEYWORDS.some((kw) => brief.toLowerCase().includes(kw.toLowerCase()));
  const isImageTask = !isVideoTask && IMAGE_KEYWORDS.some((kw) => brief.toLowerCase().includes(kw.toLowerCase()));
  const taskType = isVideoTask ? "video_production" : isImageTask ? "image_production" : "project_plan";

  // 태스크 유형에 맞는 캐릭터 우선 배정
  let assigneeId = actorId;
  if (isVideoTask || isImageTask) {
    // 영상/이미지 → 마케팅 팀 캐릭터
    const { data: mktChars } = await sb
      .from("characters")
      .select("id")
      .eq("active_flag", true)
      .eq("division_id", "div_marketing")
      .limit(1);
    assigneeId = String(mktChars?.[0]?.id ?? actorId);
  } else {
    const { data: anyChars } = await sb
      .from("characters")
      .select("id")
      .eq("active_flag", true)
      .limit(1);
    assigneeId = String(anyChars?.[0]?.id ?? actorId);
  }

  // Local-first baseline: create one real executable task then execute ai-actions inline.
  const { data: createdTask } = await sb.from("tasks").insert({
    project_id: projectId,
    title: `${projectTitle} - execution draft`,
    description: brief,
    task_type: taskType,
    state: "Todo",
    priority: "High",
    assignee_character_id: assigneeId,
    created_at: now,
    updated_at: now,
  }).select("id").single();

  await Promise.resolve(sb.from("projects").update({ state: "Active", updated_at: now }).eq("id", projectId)).catch(() => {});

  if (createdTask?.id) {
    await runLocalAiAction({
      input: { taskId: createdTask.id, characterId: assigneeId },
    }, actorId, traceId);
  }
}

async function runLocalAiAction(
  payload: Record<string, unknown>,
  actorId: string,
  traceId: string | null,
): Promise<void> {
  const sb = getSupabase();
  const input = (payload["input"] as Record<string, unknown> | undefined) ?? payload;
  const taskId = String(input["taskId"] ?? input["task_id"] ?? "");
  if (!taskId) return;

  const { data: task } = await sb
    .from("tasks")
    .select("id, title, description, task_type, assignee_character_id, project_id, priority")
    .eq("id", taskId)
    .single();
  if (!task) return;

  const characterId = String(input["characterId"] ?? task.assignee_character_id ?? actorId);
  const now = new Date().toISOString();

  await sb.from("tasks").update({ state: "InProgress", updated_at: now }).eq("id", taskId);

  const taskType = String(task.task_type ?? "document").toLowerCase();
  const imagePrompt = [String(task.title ?? ""), String(task.description ?? "")].filter(Boolean).join(". ");
  const textPrompt = [
    `Task: ${String(task.title ?? "")}`,
    task.description ? `Description: ${String(task.description)}` : "",
    "Return practical, structured output with clear action items.",
  ].filter(Boolean).join("\n");

  let output = "";
  if (taskType === "image_production") {
    try {
      const img = await generateImage({ prompt: imagePrompt });
      if (img.ok) {
        const src = img.imageUrl ?? `data:${img.mimeType};base64,${img.imageBase64}`;
        output = `![${String(task.title ?? "generated image")}](${src})\n\n> ${img.provider} / ${img.modelUsed}로 생성`;
      } else {
        output = `# 이미지 생성 실패\n\n오류: ${img.errorCode ?? "알 수 없는 오류"}`;
      }
    } catch (err) {
      output = `# 이미지 생성 실패\n\n${String(err)}`;
    }
  } else if (taskType === "video_production") {
    try {
      const aspectRatio = imagePrompt.includes("세로") || imagePrompt.includes("릴스") || imagePrompt.includes("reels") || imagePrompt.includes("쇼츠") ? "9:16" : "16:9";
      const vid = await generateVideo({ prompt: imagePrompt, aspectRatio, duration: "5" });
      if (vid.ok && vid.videoUrl) {
        output = `[VIDEO](${vid.videoUrl})\n\n> ${vid.provider} / ${vid.modelUsed}로 생성`;
      } else {
        output = `# 영상 생성 실패\n\n오류: ${vid.errorCode ?? "알 수 없는 오류"}`;
      }
    } catch (err) {
      output = `# 영상 생성 실패\n\n${String(err)}`;
    }
  } else {
    try {
      const ai = await routeAI({
        characterId,
        taskType,
        prompt: textPrompt,
        maxTokens: 1200,
      });
      output = ai.output;
    } catch {
      output = [
        `# ${String(task.title ?? "Task Output")}`,
        "",
        "## Summary",
        "Local fallback output generated because AI call was unavailable.",
        "",
        "## Next Actions",
        "1. Validate scope",
        "2. Implement first increment",
        "3. Run review",
      ].join("\n");
    }
  }

  await sb.from("artifacts").insert({
    project_id: task.project_id,
    task_id: taskId,
    artifact_type: task.task_type ?? "document",
    title: `${String(task.title ?? "Task")} output`,
    content_markdown: output,
    author_character_id: characterId,
    status: "Draft",
    created_at: now,
    updated_at: now,
  });

  await sb.from("tasks").update({
    state: "Done",
    completed_at: now,
    updated_at: now,
    ai_output: { text: output, traceId: traceId ?? `local-${taskId}` },
  }).eq("id", taskId);
}

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

    // Insert outbox record first (durability: relay picks it up if enqueue fails)
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

    // Enqueue job — idempotencyKey prevents double-processing
    const queued = await enqueueJob({
      queueName: parsed.data.queueName,
      payload: jobPayload,
      requestedByCharacterId: actorId,
      traceId,
      idempotencyKey,
    });

    if (getRuntimeProfile() === "local") {
      await runLocalInlineJob({
        queueName: parsed.data.queueName,
        payload: jobPayload,
        actorId,
        traceId,
      });
    }

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
