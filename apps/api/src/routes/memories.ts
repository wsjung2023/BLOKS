// Memory RAG routes — /api/v1/memories
import { Router } from "express";
import { z } from "zod";
import {
  createMemory,
  searchMemories,
  listCharacterMemories,
  deleteMemory,
  linkMemoryToCharacters,
} from "@bloks/memory";

export const memoriesRouter = Router();

const createSchema = z.object({
  memoryScope: z.enum(["company", "team", "character", "project"]),
  scopeEntityId: z.string().min(1),
  memoryType: z.enum(["preference", "lesson", "warning", "relationship", "strategy"]),
  summary: z.string().min(1).max(2000),
  importanceScore: z.number().min(0).max(1).default(0.5),
  decayPolicy: z.enum(["long", "medium", "short"]).default("medium"),
  sourceEventId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  visibilityLevel: z.enum(["private", "team", "exec", "company"]).default("private"),
});

const searchSchema = z.object({
  characterId: z.string().min(1),
  query: z.string().min(1).max(500),
  topK: z.coerce.number().int().min(1).max(20).default(5),
  threshold: z.coerce.number().min(0).max(1).default(0.6),
});

const listSchema = z.object({
  characterId: z.string().min(1),
  memoryType: z.enum(["preference", "lesson", "warning", "relationship", "strategy"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const linkSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(1),
  relevanceScore: z.number().min(0).max(1).default(1.0),
  visibilityLevel: z.enum(["private", "team", "exec", "company"]).default("private"),
});

// POST /memories — create + embed

memoriesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }

  try {
    const { characterIds, ...memoryInput } = parsed.data;
    const memory = await createMemory(memoryInput);
    res.status(201).json({ ok: true, data: memory });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[memories] create error", msg);
    if (msg.includes("OPENAI_API_KEY")) {
      res.status(503).json({ ok: false, error: { code: "EMBEDDING_UNAVAILABLE", message: "OpenAI API 키가 설정되지 않아 임베딩을 생성할 수 없습니다." } });
    } else {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "메모리 생성에 실패했습니다." } });
    }
  }
});

// GET /memories/search — semantic search

memoriesRouter.get("/search", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() } });
    return;
  }

  try {
    const results = await searchMemories(parsed.data);
    res.json({ ok: true, data: { items: results, count: results.length } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error("[memories] search error", msg);
    if (msg.includes("OPENAI_API_KEY")) {
      res.status(503).json({ ok: false, error: { code: "EMBEDDING_UNAVAILABLE", message: "OpenAI API 키가 설정되지 않아 검색할 수 없습니다." } });
    } else {
      res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "메모리 검색에 실패했습니다." } });
    }
  }
});

// GET /memories — list memories by character

memoriesRouter.get("/", async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { code: "INVALID_QUERY", message: "characterId가 필요합니다.", details: parsed.error.flatten() } });
    return;
  }

  try {
    const items = await listCharacterMemories(parsed.data.characterId, {
      limit: parsed.data.limit,
      memoryType: parsed.data.memoryType,
    });
    res.json({ ok: true, data: { items, total: items.length } });
  } catch (err) {
    console.error("[memories] list error", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "메모리 목록 조회에 실패했습니다." } });
  }
});

// POST /memories/:id/link — link existing memory to characters

memoriesRouter.post("/:id/link", async (req, res) => {
  const memoryId = req.params["id"];
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }

  try {
    await linkMemoryToCharacters(memoryId, parsed.data.characterIds, {
      relevanceScore: parsed.data.relevanceScore,
      visibilityLevel: parsed.data.visibilityLevel,
    });
    res.json({ ok: true, data: { memoryId, linkedCount: parsed.data.characterIds.length } });
  } catch (err) {
    console.error("[memories] link error", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "메모리 링크에 실패했습니다." } });
  }
});

// DELETE /memories/:id

memoriesRouter.delete("/:id", async (req, res) => {
  const memoryId = req.params["id"];
  try {
    await deleteMemory(memoryId);
    res.json({ ok: true, data: { deleted: memoryId } });
  } catch (err) {
    console.error("[memories] delete error", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "메모리 삭제에 실패했습니다." } });
  }
});
