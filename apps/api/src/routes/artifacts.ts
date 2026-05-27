import { Router } from "express";
import { z } from "zod";
import { getDb } from "@bloks/db";
import { routeAI } from "@bloks/ai-router";

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
    const sb = getDb();
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

artifactsRouter.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("artifacts")
      .select("id, project_id, task_id, artifact_type, title, content_markdown, status, author_character_id, created_at, updated_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      if (error && isMissingTableError(error)) {
        res.status(501).json({ ok: false, error: { code: "ARTIFACT_TABLE_NOT_READY", message: "artifacts 테이블이 준비되지 않았습니다." } });
        return;
      }
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "아티팩트를 찾을 수 없습니다." } });
      return;
    }
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});

const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  status: z.enum(["Draft", "Final", "Archived"]).optional(),
});

artifactsRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sb = getDb();
    await sb.from("artifacts").eq("id", id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});

artifactsRouter.put("/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = updateArtifactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates["title"] = parsed.data.title;
  if (parsed.data.content !== undefined) updates["content_markdown"] = parsed.data.content;
  if (parsed.data.status !== undefined) updates["status"] = parsed.data.status;

  try {
    const sb = getDb();
    const { data, error } = await sb
      .from("artifacts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      if (error && isMissingTableError(error)) {
        res.status(501).json({ ok: false, error: { code: "ARTIFACT_TABLE_NOT_READY", message: "artifacts 테이블이 준비되지 않았습니다." } });
        return;
      }
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "아티팩트를 찾을 수 없습니다." } });
      return;
    }
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});

const reviseSchema = z.object({
  instruction: z.string().min(1).max(500),
  characterId: z.string().optional(),
});

artifactsRouter.post("/:id/revise", async (req, res) => {
  const { id } = req.params;
  const parsed = reviseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "instruction이 필요합니다." } });
    return;
  }

  try {
    const sb = getDb();
    const { data: artifact, error } = await sb
      .from("artifacts")
      .select("id, title, content_markdown, artifact_type, author_character_id")
      .eq("id", id)
      .single();

    if (error || !artifact) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "아티팩트를 찾을 수 없습니다." } });
      return;
    }

    const charId = (parsed.data.characterId ?? artifact.author_character_id ?? "system:artifact-revise") as string;
    const prompt = [
      `아래는 "${artifact.title}" 아티팩트의 현재 내용입니다.`,
      ``,
      `[현재 내용]`,
      (artifact.content_markdown as string).slice(0, 4000),
      ``,
      `[수정 지시]`,
      parsed.data.instruction,
      ``,
      `위 지시에 따라 내용을 개선하고 수정된 전체 마크다운을 반환하세요. 원본 형식을 유지하세요.`,
    ].join("\n");

    const aiResult = await routeAI({
      characterId: charId,
      taskType: "document",
      prompt,
      systemPrompt: "당신은 전문적인 문서 편집자입니다. 지시에 따라 내용을 수정하고 전체 수정된 마크다운을 반환합니다.",
      maxTokens: 3000,
    });

    const revisedContent = (aiResult.output as string ?? "").trim();
    if (!revisedContent) {
      res.status(500).json({ ok: false, error: { code: "AI_EMPTY_RESPONSE", message: "AI가 수정 결과를 반환하지 않았습니다." } });
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await sb
      .from("artifacts")
      .update({ content_markdown: revisedContent, updated_at: now })
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "저장 중 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: updated });
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
    const sb = getDb();
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
