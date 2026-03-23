// Tasks routes — GET /tasks, POST /tasks, PATCH /tasks/:id/state
import { Router } from "express";
import { z } from "zod";
import { TaskState, TASK_TRANSITIONS } from "@bloks/shared";

export const tasksRouter = Router();

// ── Placeholder store ─────────────────────────────────────────────────────────

const PLACEHOLDER_TASKS = [
  {
    id: "task_001",
    projectId: "proj_001",
    title: "PRD 초안 작성",
    state: TaskState.Done,
    priority: "High",
    assigneeId: "char_001",
    createdAt: new Date("2026-02-05T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-10T00:00:00Z").toISOString(),
  },
  {
    id: "task_002",
    projectId: "proj_001",
    title: "백엔드 API 개발",
    state: TaskState.InProgress,
    priority: "High",
    assigneeId: "char_002",
    createdAt: new Date("2026-02-10T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-20T00:00:00Z").toISOString(),
  },
  {
    id: "task_003",
    projectId: "proj_001",
    title: "UI 컴포넌트 구현",
    state: TaskState.InProgress,
    priority: "Medium",
    assigneeId: "char_002",
    createdAt: new Date("2026-02-15T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-18T00:00:00Z").toISOString(),
  },
  {
    id: "task_004",
    projectId: "proj_002",
    title: "경쟁사 분석 리포트",
    state: TaskState.PendingReview,
    priority: "Medium",
    assigneeId: "char_003",
    createdAt: new Date("2026-02-20T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-22T00:00:00Z").toISOString(),
  },
  {
    id: "task_005",
    projectId: "proj_002",
    title: "SNS 카피라이팅",
    state: TaskState.Created,
    priority: "Low",
    assigneeId: "char_003",
    createdAt: new Date("2026-03-01T00:00:00Z").toISOString(),
    updatedAt: new Date("2026-03-01T00:00:00Z").toISOString(),
  },
];

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  state: z.nativeEnum(TaskState).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(500),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
  assigneeId: z.string().optional(),
});

const stateTransitionSchema = z.object({
  state: z.nativeEnum(TaskState),
  reasonCode: z.string().optional(),
});

// ── GET /tasks ────────────────────────────────────────────────────────────────

tasksRouter.get("/", (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { projectId, assigneeId, state, limit, offset } = parsed.data;
  let results = [...PLACEHOLDER_TASKS];

  if (projectId)  results = results.filter((t) => t.projectId === projectId);
  if (assigneeId) results = results.filter((t) => t.assigneeId === assigneeId);
  if (state)      results = results.filter((t) => t.state === state);

  const total = results.length;
  const page = results.slice(offset, offset + limit);

  res.json({ ok: true, data: { items: page, total, limit, offset } });
});

// ── POST /tasks ───────────────────────────────────────────────────────────────

tasksRouter.post("/", (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const now = new Date().toISOString();
  const newTask = {
    id: `task_${Date.now()}`,
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    state: TaskState.Draft,
    priority: parsed.data.priority,
    assigneeId: parsed.data.assigneeId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  PLACEHOLDER_TASKS.push(newTask as (typeof PLACEHOLDER_TASKS)[number]);

  res.status(201).json({ ok: true, data: newTask });
});

// ── PATCH /tasks/:id/state ────────────────────────────────────────────────────

tasksRouter.patch("/:id/state", (req, res) => {
  const taskId = req.params["id"];
  const parsed = stateTransitionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const task = PLACEHOLDER_TASKS.find((t) => t.id === taskId);
  if (!task) {
    res.status(404).json({
      ok: false,
      error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다.", details: { taskId } },
    });
    return;
  }

  const allowed = TASK_TRANSITIONS[task.state as TaskState] ?? [];
  if (!allowed.includes(parsed.data.state)) {
    res.status(409).json({
      ok: false,
      error: {
        code: "INVALID_STATE_TRANSITION",
        message: `${task.state} → ${parsed.data.state} 전이는 허용되지 않습니다.`,
        details: { from: task.state, to: parsed.data.state, taskId },
      },
    });
    return;
  }

  task.state = parsed.data.state;
  task.updatedAt = new Date().toISOString();

  res.json({ ok: true, data: task });
});
