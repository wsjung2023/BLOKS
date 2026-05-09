// Prompt templates routes — GET/PATCH for /api/v1/prompts
import { Router } from "express";
import { z } from "zod";
import { getSupabase } from "@bloks/db";

export const promptsRouter = Router();

const listQuerySchema = z.object({
  taskType: z.string().optional(),
  characterId: z.string().optional(),
  roleId: z.string().optional(),
  activeOnly: z.coerce.boolean().default(true),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const patchSchema = z.object({
  templateBody: z.string().min(1).max(20000),
  activeFlag: z.boolean().optional(),
});

// GET /prompts

promptsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() } });
    return;
  }

  const { taskType, characterId, roleId, activeOnly, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const sb = getSupabase();
    let query = sb
      .from("prompt_templates")
      .select("id, task_type, template_body, version, active_flag, character_id, role_id, created_at", { count: "exact" })
      .range(from, to)
      .order("task_type", { ascending: true });

    if (activeOnly) query = query.eq("active_flag", true);
    if (taskType) query = query.eq("task_type", taskType);
    if (characterId) query = query.eq("character_id", characterId);
    if (roleId) query = query.eq("role_id", roleId);

    const { data, count, error } = await query;
    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], page, pageSize, total: count ?? 0 } });
  } catch (err) {
    console.error("[prompts] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// GET /prompts/:id

promptsRouter.get("/:id", async (req, res) => {
  const id = req.params["id"];
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("prompt_templates")
      .select("id, task_type, template_body, version, active_flag, character_id, role_id, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "프롬프트 템플릿을 찾을 수 없습니다." } });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[prompts] detail exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// PATCH /prompts/:id

promptsRouter.patch("/:id", async (req, res) => {
  const id = req.params["id"];
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }

  const { templateBody, activeFlag } = parsed.data;

  try {
    const sb = getSupabase();

    // Fetch current version
    const { data: existing } = await sb
      .from("prompt_templates")
      .select("id, version")
      .eq("id", id)
      .single();

    if (!existing) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "프롬프트 템플릿을 찾을 수 없습니다." } });
      return;
    }

    const updates: Record<string, unknown> = {
      template_body: templateBody,
      version: (existing.version ?? 1) + 1,
    };
    if (activeFlag !== undefined) updates["active_flag"] = activeFlag;

    const { data, error } = await sb
      .from("prompt_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "업데이트에 실패했습니다." } });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[prompts] patch exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
