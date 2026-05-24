// Projects routes — GET/POST for /api/v1/projects with Supabase
import { Router } from "express";
import { z } from "zod";
import { QUEUE_NAMES } from "@bloks/shared";
import { getSupabase } from "@bloks/db";
import { enqueueJob } from "../queues/registry.js";

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
    const sb = getSupabase();
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
    const sb = getSupabase();
    const { data: inserted, error } = await sb
      .from("projects")
      .insert({
        company_id: DEFAULT_COMPANY_ID,
        title: parsed.data.title,
        description: parsed.data.brief ?? null,
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

    void enqueueJob({
      queueName: QUEUE_NAMES.orchestrate,
      payload: { projectId: inserted.id, title: inserted.title, brief: parsed.data.brief ?? "" },
    });

    res.status(201).json({ ok: true, data: inserted });
  } catch (err) {
    console.error("[projects] post exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
