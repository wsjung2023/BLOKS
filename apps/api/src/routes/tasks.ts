// Tasks routes — full state machine for /api/v1/tasks with Supabase
import { Router } from "express";
import { z } from "zod";
import { getSupabase } from "@bloks/db";
import { TaskState } from "@bloks/shared";
import { isAllowedTransition, writeEventLog, reduceAssigneeWorkload } from "./tasks-helpers.js";
import { emitWorldEvent } from "./stream.js";

export const tasksRouter = Router();

// ── Schemas ───────────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  assigneeCharacterId: z.string().optional(),
  state: z.nativeEnum(TaskState).optional(),
  priority: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  taskType: z.string().optional(),
  priority: z.enum(["P0", "P1", "P2", "P3", "P4"]).default("P2"),
  createdByCharacterId: z.string().optional(),
  assigneeCharacterId: z.string().optional().nullable(),
  reviewerCharacterId: z.string().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

const stateTransitionSchema = z.object({
  nextState: z.nativeEnum(TaskState),
  changedByCharacterId: z.string().optional(),
  reasonCode: z.string().optional(),
  comment: z.string().max(2000).optional(),
});

const aiOutputSchema = z.object({
  outputText: z.string().min(1),
  modelUsed: z.string().optional(),
  tokensUsed: z.number().int().optional(),
  costUsd: z.number().optional(),
});

// ── GET /tasks ────────────────────────────────────────────────────────────────

tasksRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { projectId, assigneeCharacterId, state, priority, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const sb = getSupabase();
    let query = sb
      .from("tasks")
      .select("id, project_id, parent_task_id, title, description, task_type, priority, state, assignee_character_id, reviewer_character_id, due_at, ai_output, created_at, updated_at", { count: "exact" })
      .range(from, to)
      .order("created_at", { ascending: false });

    if (projectId) query = query.eq("project_id", projectId);
    if (assigneeCharacterId) query = query.eq("assignee_character_id", assigneeCharacterId);
    if (state) query = query.eq("state", state);
    if (priority) query = query.eq("priority", priority);

    const { data, count, error } = await query;
    if (error) {
      console.error("[tasks] list error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], page, pageSize, total: count ?? 0 } });
  } catch (err) {
    console.error("[tasks] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /tasks ───────────────────────────────────────────────────────────────

tasksRouter.post("/", async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
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
    const {
      projectId, parentTaskId, title, description, taskType,
      priority, createdByCharacterId, assigneeCharacterId, reviewerCharacterId, dueAt,
    } = parsed.data;

    // Validate parentTaskId belongs to same project
    if (parentTaskId) {
      const { data: parent } = await sb.from("tasks").select("project_id").eq("id", parentTaskId).single();
      if (!parent || parent.project_id !== projectId) {
        res.status(422).json({
          ok: false,
          error: { code: "VALIDATION_ERROR", message: "부모 태스크가 같은 프로젝트에 속하지 않습니다." },
        });
        return;
      }
    }

    const initialState = assigneeCharacterId ? TaskState.Assigned : TaskState.Created;

    const { data, error } = await sb
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentTaskId ?? null,
        title,
        description: description ?? null,
        task_type: taskType ?? null,
        priority,
        state: initialState,
        assignee_character_id: assigneeCharacterId ?? null,
        reviewer_character_id: reviewerCharacterId ?? null,
        due_at: dueAt ?? null,
        created_by_character_id: createdByCharacterId ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[tasks] create error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "태스크 생성에 실패했습니다." } });
      return;
    }

    await writeEventLog(sb, {
      entityType: "task", entityId: data.id, eventType: "task.created",
      previousState: null, nextState: initialState,
      changedBy: createdByCharacterId ?? req.auth?.sub ?? "system",
      relatedProjectId: projectId, relatedTaskId: data.id,
    });

    res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error("[tasks] create exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── PATCH /tasks/:id/state ─────────────────────────────────────────────────────

tasksRouter.patch("/:id/state", async (req, res) => {
  const taskId = req.params["id"];
  const parsed = stateTransitionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { nextState, changedByCharacterId, reasonCode, comment } = parsed.data;

  try {
    const sb = getSupabase();

    const { data: task, error: fetchError } = await sb
      .from("tasks")
      .select("id, state, project_id, assignee_character_id, reviewer_character_id")
      .eq("id", taskId)
      .single();

    if (fetchError || !task) {
      res.status(404).json({
        ok: false,
        error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다.", details: { taskId } },
      });
      return;
    }

    const currentState = task.state as TaskState;

    if (!isAllowedTransition(currentState, nextState)) {
      res.status(409).json({
        ok: false,
        error: {
          code: "TASK_INVALID_TRANSITION",
          message: `${currentState} → ${nextState} 전이는 허용되지 않습니다.`,
          details: { from: currentState, to: nextState, taskId },
        },
      });
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await sb
      .from("tasks")
      .update({ state: nextState, updated_at: now })
      .eq("id", taskId)
      .select()
      .single();

    if (updateError || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "상태 업데이트에 실패했습니다." } });
      return;
    }

    const actor = changedByCharacterId ?? req.auth?.sub ?? "system";

    // On Done: reduce assignee workload + log
    if (nextState === TaskState.Done) {
      await reduceAssigneeWorkload(sb, task.assignee_character_id);
    }

    await writeEventLog(sb, {
      entityType: "task", entityId: taskId, eventType: "task.state.changed",
      previousState: currentState, nextState,
      changedBy: actor,
      reasonCode: reasonCode ?? null,
      comment: comment ?? null,
      relatedProjectId: task.project_id,
      relatedTaskId: taskId,
    });

    emitWorldEvent("task_state_changed", {
      taskId,
      projectId: task.project_id,
      assigneeCharacterId: task.assignee_character_id,
      previousState: currentState,
      nextState,
    });

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[tasks] state transition exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /tasks/:id/ai-output ─────────────────────────────────────────────────

tasksRouter.post("/:id/ai-output", async (req, res) => {
  const taskId = req.params["id"];
  const parsed = aiOutputSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "outputText가 필요합니다.", details: parsed.error.flatten() },
    });
    return;
  }

  try {
    const sb = getSupabase();

    const { data: task } = await sb.from("tasks").select("id").eq("id", taskId).single();
    if (!task) {
      res.status(404).json({
        ok: false,
        error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다.", details: { taskId } },
      });
      return;
    }

    const aiOutput = {
      text: parsed.data.outputText,
      modelUsed: parsed.data.modelUsed ?? null,
      tokensUsed: parsed.data.tokensUsed ?? null,
      costUsd: parsed.data.costUsd ?? null,
      savedAt: new Date().toISOString(),
    };

    const { data, error } = await sb
      .from("tasks")
      .update({ ai_output: aiOutput, updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .select("id, state, ai_output, updated_at")
      .single();

    if (error || !data) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "AI 출력 저장에 실패했습니다." } });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[tasks] ai-output exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
