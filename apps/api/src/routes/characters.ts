// Characters routes — GET /characters, GET /characters/:id
import { Router } from "express";
import { z } from "zod";

export const charactersRouter = Router();

// ── Placeholder data (replaced by DB queries in next phase) ──────────────────

const PLACEHOLDER_CHARACTERS = [
  {
    id: "char_001",
    name: "김리더",
    rank: "Director",
    department: "engineering",
    status: "Active",
    currentTaskCount: 3,
    fatigueScore: 45,
    primaryModel: "gpt-4o",
    burnoutTriggered: false,
  },
  {
    id: "char_002",
    name: "박개발",
    rank: "Senior",
    department: "engineering",
    status: "Overloaded",
    currentTaskCount: 7,
    fatigueScore: 85,
    primaryModel: "gpt-4o",
    burnoutTriggered: false,
  },
  {
    id: "char_003",
    name: "최기획",
    rank: "Manager",
    department: "marketing",
    status: "Active",
    currentTaskCount: 4,
    fatigueScore: 50,
    primaryModel: "gpt-4o",
    burnoutTriggered: false,
  },
  {
    id: "char_004",
    name: "이재무",
    rank: "Senior",
    department: "finance",
    status: "Active",
    currentTaskCount: 2,
    fatigueScore: 30,
    primaryModel: "gpt-4o",
    burnoutTriggered: false,
  },
  {
    id: "char_005",
    name: "정관리",
    rank: "VP",
    department: "management",
    status: "Active",
    currentTaskCount: 5,
    fatigueScore: 55,
    primaryModel: "gpt-4o",
    burnoutTriggered: false,
  },
];

// ── Query schema ──────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  department: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── GET /characters ───────────────────────────────────────────────────────────

charactersRouter.get("/", (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { department, status, limit, offset } = parsed.data;
  let results = [...PLACEHOLDER_CHARACTERS];

  if (department) results = results.filter((c) => c.department === department);
  if (status) results = results.filter((c) => c.status === status);

  const total = results.length;
  const page = results.slice(offset, offset + limit);

  res.json({
    ok: true,
    data: { items: page, total, limit, offset },
  });
});

// ── GET /characters/:id ───────────────────────────────────────────────────────

const idParamSchema = z.object({ id: z.string().min(1) });

charactersRouter.get("/:id", (req, res) => {
  const parsed = idParamSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_PARAM", message: "잘못된 ID 형식입니다." },
    });
    return;
  }

  const character = PLACEHOLDER_CHARACTERS.find((c) => c.id === parsed.data.id);
  if (!character) {
    res.status(404).json({
      ok: false,
      error: { code: "CHARACTER_NOT_FOUND", message: "캐릭터를 찾을 수 없습니다.", details: { id: parsed.data.id } },
    });
    return;
  }

  res.json({ ok: true, data: character });
});
