// Projects routes — GET/POST for /api/v1/projects
import { Router } from "express";
import { z } from "zod";
import { QUEUE_NAMES } from "@bloks/shared";
import { getDb, getRuntimeProfile } from "@bloks/db";
import { enqueueJob } from "../queues/registry.js";
import { runLocalInlineJob } from "./jobs.js";

export const projectsRouter = Router();

const DEFAULT_COMPANY_ID = "company_001";

// DB state enum: Draft | Active | OnHold | Completed | Cancelled
const DB_STATE = z.enum(["Draft", "Active", "OnHold", "Completed", "Cancelled"]);

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  state: DB_STATE.optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  brief: z.string().min(1).max(2000).optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  ownerId: z.string().min(1).optional(),
  virtualBudgetAllocated: z.number().positive().optional(),
  attachmentIds: z.array(z.string()).max(10).optional(),
});

// ── GET /projects ─────────────────────────────────────────────────────────────

projectsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { state, priority, limit, offset } = parsed.data;
  const from = offset;
  const to = offset + limit - 1;

  try {
    const sb = getDb();
    let query = sb
      .from("projects")
      .select("*", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (state) query = query.eq("state", state);
    if (priority) query = query.eq("priority", priority);

    const { data, count, error } = await query;
    if (error) {
      console.error("[projects] list error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], total: count ?? 0, limit, offset } });
  } catch (err) {
    console.error("[projects] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /projects ────────────────────────────────────────────────────────────

projectsRouter.post("/", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  try {
    const sb = getDb();

    // 첨부파일 컨텍스트 병합
    let enrichedBrief = parsed.data.brief ?? "";
    if (parsed.data.attachmentIds?.length) {
      const { data: atts } = await sb.from("attachments").select("filename, extracted_text").in("id", parsed.data.attachmentIds);
      if (atts?.length) {
        const attContext = (atts as Array<{ filename: string; extracted_text: string }>)
          .map(a => `[첨부: ${a.filename}]\n${a.extracted_text}`)
          .join("\n\n---\n\n");
        enrichedBrief = enrichedBrief
          ? `${enrichedBrief}\n\n[첨부 파일 내용]\n${attContext}`
          : `[첨부 파일 내용]\n${attContext}`;
      }
    }

    const { data: inserted, error } = await sb
      .from("projects")
      .insert({
        company_id: DEFAULT_COMPANY_ID,
        title: parsed.data.title,
        description: enrichedBrief || null,
        state: "Draft",
        priority: parsed.data.priority,
        owner_id: parsed.data.ownerId ?? null,
        budget_allocated: parsed.data.virtualBudgetAllocated ?? 0,
        budget_used: 0,
      })
      .select()
      .single();

    if (error || !inserted) {
      console.error("[projects] insert error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "프로젝트 생성에 실패했습니다." } });
      return;
    }

    const jobPayload = { projectId: inserted.id, title: inserted.title, brief: enrichedBrief };

    if (getRuntimeProfile() === "local") {
      void runLocalInlineJob({
        queueName: QUEUE_NAMES.orchestrate,
        payload: jobPayload,
        actorId: "system",
        traceId: null,
      });
    } else {
      void enqueueJob({ queueName: QUEUE_NAMES.orchestrate, payload: jobPayload });
    }

    res.status(201).json({ ok: true, data: inserted });
  } catch (err) {
    console.error("[projects] post exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
