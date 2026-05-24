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
  ids: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

const createTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: z.string().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  taskType: z.string().optional(),
  priority: z.enum(["Critical", "High", "Medium", "Low"]).default("Medium"),
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

  const { projectId, assigneeCharacterId, state, priority, ids, page, pageSize } = parsed.data;
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
    if (ids) query = query.in("id", ids.split(",").filter(Boolean));

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

    const initialState = assigneeCharacterId ? TaskState.Todo : TaskState.Backlog;

    const { data, error } = await sb
      .from("tasks")
      .insert({
        project_id: projectId,
        parent_task_id: parentTaskId ?? null,
        title,
        description: description ?? null,
        task_type: taskType ?? "general",
        priority,
        state: initialState,
        assignee_character_id: assigneeCharacterId ?? null,
        reviewer_character_id: reviewerCharacterId ?? null,
        due_at: dueAt ?? null,
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

    // Unblock downstream tasks when this task is Done
    if (nextState === TaskState.Done) {
      const { data: deps } = await sb
        .from("task_dependencies")
        .select("successor_id")
        .eq("predecessor_id", taskId)
        .eq("active_flag", true);

      for (const dep of deps ?? []) {
        // Check if ALL predecessors of this successor are Done
        const { data: allPreds } = await sb
          .from("task_dependencies")
          .select("predecessor_id, tasks!inner(state)")
          .eq("successor_id", dep.successor_id)
          .eq("active_flag", true);

        const allDone = (allPreds ?? []).every(p => {
          const t = p.tasks as { state: string } | Array<{ state: string }>;
          const state = Array.isArray(t) ? (t[0]?.state ?? "") : t.state;
          return state === "Done";
        });

        if (allDone) {
          await sb.from("tasks")
            .update({ state: TaskState.Todo, updated_at: now })
            .eq("id", dep.successor_id)
            .eq("state", "Blocked");

          const { data: unblockedTask } = await sb.from("tasks")
            .select("id, title, assignee_character_id")
            .eq("id", dep.successor_id).single();

          if (unblockedTask?.assignee_character_id) {
            emitWorldEvent("character_bubble", {
              characterId: unblockedTask.assignee_character_id,
              bubbleType: "speech",
              text: `💼 ${(unblockedTask.title as string).slice(0, 30)} 시작합니다`,
              duration: 8000,
            });
          }
        }
      }
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

// ── POST /tasks/:id/founder-override ─────────────────────────────────────────
// Founder forcibly changes task priority, state, description, or assignee.

const founderOverrideSchema = z.object({
  action: z.enum(["urgent", "pause", "redirect", "reassign"]),
  payload: z.object({
    description: z.string().optional(),
    assigneeCharacterId: z.string().uuid().optional(),
  }).optional(),
});

tasksRouter.post("/:id/founder-override", async (req, res) => {
  const taskId = req.params["id"];
  const parsed = founderOverrideSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }

  const { action, payload } = parsed.data;

  try {
    const sb = getSupabase();
    const { data: task, error: fetchErr } = await sb
      .from("tasks")
      .select("id, title, state, priority, assignee_character_id, project_id")
      .eq("id", taskId)
      .single();

    if (fetchErr || !task) {
      res.status(404).json({ ok: false, error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다." } });
      return;
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now };

    if (action === "urgent")   update.priority = "Critical";
    if (action === "pause")    update.state = "Blocked";
    if (action === "redirect" && payload?.description) update.description = payload.description;
    if (action === "reassign" && payload?.assigneeCharacterId) update.assignee_character_id = payload.assigneeCharacterId;

    const { data: updated, error: updateErr } = await sb
      .from("tasks").update(update).eq("id", taskId).select().single();

    if (updateErr || !updated) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "업데이트에 실패했습니다." } });
      return;
    }

    await writeEventLog(sb, {
      entityType: "task", entityId: taskId, eventType: "task.founder.override",
      previousState: task.state as TaskState, nextState: (update.state as TaskState) ?? (task.state as TaskState),
      changedBy: "founder",
      reasonCode: action.toUpperCase(),
      comment: `Founder override: ${action}`,
      relatedProjectId: task.project_id as string ?? null,
      relatedTaskId: taskId,
    });

    emitWorldEvent("founder_override", {
      taskId,
      action,
      assigneeCharacterId: task.assignee_character_id,
      newPriority: update.priority,
      newState: update.state,
    });

    // Notify assignee via bubble
    if (task.assignee_character_id) {
      const bubbleText =
        action === "urgent"   ? "⚡ 파운더 긴급 지시! P0으로 격상됐어요" :
        action === "pause"    ? "⏸️ 파운더가 태스크를 일시 중지했습니다" :
        action === "reassign" ? "📋 파운더가 태스크를 재배정했습니다" :
                                "📝 파운더가 방향을 수정했습니다";
      emitWorldEvent("character_bubble", {
        characterId: task.assignee_character_id,
        bubbleType: "speech",
        text: bubbleText,
        isFounderMessage: true,
        duration: 9000,
      });
    }

    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[tasks] founder-override exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /tasks/:id/feedback ──────────────────────────────────────────────────
// Founder 또는 리뷰어가 InReview 태스크에 피드백을 남기고 재작업을 요청한다.

const feedbackSchema = z.object({
  comment: z.string().min(1).max(2000),
  requestRevision: z.boolean().default(true),
  changedByCharacterId: z.string().optional(),
});

tasksRouter.post("/:id/feedback", async (req, res) => {
  const taskId = req.params["id"];
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() } });
    return;
  }
  const { comment, requestRevision, changedByCharacterId } = parsed.data;

  try {
    const sb = getSupabase();
    const { data: task } = await sb
      .from("tasks")
      .select("id, state, assignee_character_id, revision_count, feedback_history")
      .eq("id", taskId)
      .single();

    if (!task) {
      res.status(404).json({ ok: false, error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다." } });
      return;
    }

    const now = new Date().toISOString();
    const revisionCount = (task.revision_count as number) ?? 0;
    const feedbackHistory = Array.isArray(task.feedback_history) ? [...(task.feedback_history as unknown[])] : [];

    feedbackHistory.push({ comment, by: changedByCharacterId ?? req.auth?.sub ?? "founder", at: now, revision: revisionCount + 1 });

    const update: Record<string, unknown> = { feedback_history: feedbackHistory, updated_at: now };
    if (requestRevision) {
      update.state = TaskState.Todo;
      update.revision_count = revisionCount + 1;
    }

    await sb.from("tasks").update(update).eq("id", taskId);

    if (requestRevision && task.assignee_character_id) {
      emitWorldEvent("character_bubble", {
        characterId: task.assignee_character_id,
        bubbleType: "speech",
        text: `📝 피드백: "${comment.slice(0, 28)}"`,
        duration: 9000,
      });
      emitWorldEvent("task_state_changed", {
        taskId,
        characterId: task.assignee_character_id,
        from: task.state,
        to: TaskState.Todo,
      });
    }

    res.json({ ok: true, data: { taskId, requestRevision, revisionCount: revisionCount + 1 } });
  } catch (err) {
    console.error("[tasks] feedback exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});
