// Projects routes — GET /projects, POST /projects
import { Router } from "express";
import { z } from "zod";
import { ProjectState } from "@bloks/shared";

export const projectsRouter = Router();

// ── Placeholder store (replaced by DB in next phase) ─────────────────────────

const PLACEHOLDER_PROJECTS = [
  {
    id: "proj_001",
    title: "신규 앱 출시",
    state: ProjectState.InExecution,
    priority: "High",
    ownerId: "char_001",
    virtualBudgetAllocated: 1000000,
    virtualBudgetConsumed: 450000,
    apiCostAccumulated: 12.50,
    riskState: "Warning",
    createdAt: new Date("2026-02-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-20T00:00:00Z").toISOString(),
  },
  {
    id: "proj_002",
    title: "마케팅 캠페인 Q2",
    state: ProjectState.InPlanning,
    priority: "Medium",
    ownerId: "char_003",
    virtualBudgetAllocated: 500000,
    virtualBudgetConsumed: 50000,
    apiCostAccumulated: 3.20,
    riskState: "Normal",
    createdAt: new Date("2026-02-15T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-22T00:00:00Z").toISOString(),
  },
  {
    id: "proj_003",
    title: "내부 운영 자동화",
    state: ProjectState.Intake,
    priority: "Low",
    ownerId: "char_005",
    virtualBudgetAllocated: 200000,
    virtualBudgetConsumed: 0,
    apiCostAccumulated: 0,
    riskState: "Normal",
    createdAt: new Date("2026-03-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-01T00:00:00Z").toISOString(),
  },
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  state: z.nativeEnum(ProjectState).optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createProjectSchema = z.object({
  title: z.string().min(1).max(200),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  ownerId: z.string().min(1).optional(),
  virtualBudgetAllocated: z.number().positive().optional(),
});

// ── GET /projects ─────────────────────────────────────────────────────────────

projectsRouter.get("/", (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { state, priority, limit, offset } = parsed.data;
  let results = [...PLACEHOLDER_PROJECTS];

  if (state) results = results.filter((p) => p.state === state);
  if (priority) results = results.filter((p) => p.priority === priority);

  const total = results.length;
  const page = results.slice(offset, offset + limit);

  res.json({ ok: true, data: { items: page, total, limit, offset } });
});

// ── POST /projects ────────────────────────────────────────────────────────────

projectsRouter.post("/", (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const now = new Date().toISOString();
  const newProject = {
    id: `proj_${Date.now()}`,
    title: parsed.data.title,
    state: ProjectState.Idea,
    priority: parsed.data.priority,
    ownerId: parsed.data.ownerId ?? req.auth?.sub ?? "unknown",
    virtualBudgetAllocated: parsed.data.virtualBudgetAllocated ?? 0,
    virtualBudgetConsumed: 0,
    apiCostAccumulated: 0,
    riskState: "Normal",
    createdAt: now,
    updatedAt: now,
  };

  PLACEHOLDER_PROJECTS.push(newProject);

  res.status(201).json({ ok: true, data: newProject });
});
