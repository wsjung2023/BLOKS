import { Router } from "express";
import { z } from "zod";
import { getSupabase } from "@bloks/db";

export const artifactsRouter = Router();

const createArtifactSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().optional(),
  artifactType: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  createdByCharacterId: z.string().optional(),
});

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  authorCharacterId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function isMissingTableError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? "";
  return message.includes("does not exist") || message.includes("relation");
}

artifactsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { projectId, taskId, authorCharacterId, limit, offset } = parsed.data;
  try {
    const sb = getSupabase();
    let query = sb
      .from("artifacts")
      .select("id, project_id, task_id, artifact_type, title, content_markdown, status, author_character_id, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (projectId) query = query.eq("project_id", projectId);
    if (taskId) query = query.eq("task_id", taskId);
    if (authorCharacterId) query = query.eq("author_character_id", authorCharacterId);

    const { data, count, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        res.status(501).json({
          ok: false,
          error: { code: "ARTIFACT_TABLE_NOT_READY", message: "artifacts 테이블이 준비되지 않았습니다. 마이그레이션/스키마를 먼저 적용해 주세요." },
        });
        return;
      }
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Artifacts 조회 중 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], total: count ?? 0, limit, offset } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});

artifactsRouter.post("/", async (req, res) => {
  const parsed = createArtifactSchema.safeParse(req.body);
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
    const { data, error } = await sb
      .from("artifacts")
      .insert({
        project_id: parsed.data.projectId,
        task_id: parsed.data.taskId ?? null,
        artifact_type: parsed.data.artifactType,
        title: parsed.data.title,
        content_markdown: parsed.data.content,
        status: "Draft",
        author_character_id: parsed.data.createdByCharacterId ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        res.status(501).json({
          ok: false,
          error: { code: "ARTIFACT_TABLE_NOT_READY", message: "artifacts 테이블이 준비되지 않았습니다. 마이그레이션/스키마를 먼저 적용해 주세요." },
        });
        return;
      }
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Artifact 생성 중 오류가 발생했습니다." } });
      return;
    }

    res.status(201).json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});
