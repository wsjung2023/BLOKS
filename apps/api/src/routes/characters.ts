// Characters routes — GET/PATCH/POST for /api/v1/characters with Supabase
import { Router } from "express";
import { z } from "zod";
import { getSupabase, writeEventLog } from "@bloks/db";
import type { CharacterRuntimeStateRecord } from "@bloks/shared";
import { emitWorldEvent } from "./stream.js";
import { enqueueJob } from "../queues/registry.js";
import { QUEUE_NAMES } from "@bloks/shared";

export const charactersRouter = Router();

// Query schemas

const listQuerySchema = z.object({
  division: z.string().optional(),
  status: z.string().optional(),
  activeMode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const runtimePatchSchema = z.object({
  activityStatus: z.string().max(120).optional(),
  workloadScore: z.number().min(0).max(100).optional(),
  fatigueScore: z.number().min(0).max(100).optional(),
  burnoutTriggered: z.boolean().optional(),
});

const characterFlagsPatchSchema = z.object({
  active_flag: z.boolean().optional(),
  ai_enabled: z.boolean().optional(),
  default_model_profile_id: z.string().optional(),
}).refine((d) => d.active_flag !== undefined || d.ai_enabled !== undefined || d.default_model_profile_id !== undefined, {
  message: "active_flag, ai_enabled, default_model_profile_id 중 하나 이상을 포함해야 합니다.",
});

const assignTaskSchema = z.object({
  taskId: z.string().min(1),
  assignedByCharacterId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

// GET /characters

charactersRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { division, status, activeMode, page, pageSize } = parsed.data;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const sb = getSupabase();

    let query = sb
      .from("characters")
      .select(`id, name, code_name, active_mode, active_flag, ai_enabled, trust_base, influence_base, persona_summary, division_id, department_id, rank_id, role_id, default_model_profile_id, current_level, total_experience, level_experience, total_tasks_done, character_runtime_states(activity_status, workload_score, fatigue_score, burnout_triggered), divisions(division_type), ranks(name), roles(name), model_profiles(id, profile_name, primary_model, provider_name)`,
        { count: "exact" }
      )
      .range(from, to);

    if (division) query = query.eq("divisions.code", division);
    if (activeMode) query = query.eq("active_mode", activeMode);
    if (status) {
      // runtime_status lives in character_runtime_states join
      query = query.eq("character_runtime_states.activity_status", status);
    }

    const { data, count, error } = await query;

    const items = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      character_runtime_states: (row["character_runtime_states"] as CharacterRuntimeStateRecord[] | CharacterRuntimeStateRecord | undefined) ?? [],
    }));

    if (error) {
      console.error("[characters] list error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }

    res.json({
      ok: true,
      data: {
        items,
        page,
        pageSize,
        total: count ?? 0,
      },
    });
  } catch (err) {
    console.error("[characters] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// GET /characters/model-profiles — list all AI model profiles

charactersRouter.get("/model-profiles", async (_req, res) => {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("model_profiles")
      .select("id, profile_name, primary_model, provider_name")
      .order("provider_name", { ascending: true });
    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 조회 오류가 발생했습니다." } });
      return;
    }
    res.json({ ok: true, data: data ?? [] });
  } catch (err) {
    console.error("[characters] model-profiles exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// GET /characters/:id

charactersRouter.get("/:id", async (req, res) => {
  const id = req.params["id"];
  if (!id) {
    res.status(400).json({ ok: false, error: { code: "INVALID_PARAM", message: "ID가 필요합니다." } });
    return;
  }

  try {
    const sb = getSupabase();

    const { data, error } = await sb
      .from("characters")
      .select(`id, name, code_name, active_mode, active_flag, ai_enabled, trust_base, influence_base, persona_summary, division_id, department_id, rank_id, role_id, character_runtime_states(activity_status, workload_score, fatigue_score, burnout_triggered), divisions(division_type), ranks(name), roles(name)`
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({
        ok: false,
        error: { code: "CHARACTER_NOT_FOUND", message: "캐릭터를 찾을 수 없습니다.", details: { id } },
      });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[characters] detail exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// PATCH /characters/:id — update active_flag / ai_enabled

charactersRouter.patch("/:id", async (req, res) => {
  const id = req.params["id"];
  const parsed = characterFlagsPatchSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.active_flag !== undefined) updates["active_flag"] = parsed.data.active_flag;
  if (parsed.data.ai_enabled !== undefined) updates["ai_enabled"] = parsed.data.ai_enabled;
  if (parsed.data.default_model_profile_id !== undefined) updates["default_model_profile_id"] = parsed.data.default_model_profile_id;

  try {
    const sb = getSupabase();

    const { data, error } = await sb
      .from("characters")
      .update(updates)
      .eq("id", id)
      .select("id, active_flag, ai_enabled, default_model_profile_id")
      .single();

    if (error || !data) {
      res.status(404).json({
        ok: false,
        error: { code: "CHARACTER_NOT_FOUND", message: "캐릭터를 찾을 수 없습니다.", details: { id } },
      });
      return;
    }

    emitWorldEvent("character_flags_updated", {
      characterId: id,
      active_flag: (data as Record<string, unknown>)["active_flag"],
      ai_enabled: (data as Record<string, unknown>)["ai_enabled"],
    });

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[characters] flags patch exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// PATCH /characters/:id/runtime

charactersRouter.patch("/:id/runtime", async (req, res) => {
  const id = req.params["id"];
  const parsed = runtimePatchSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.activityStatus !== undefined) updates["activity_status"] = parsed.data.activityStatus;
  if (parsed.data.workloadScore !== undefined) updates["workload_score"] = parsed.data.workloadScore;
  if (parsed.data.fatigueScore !== undefined) updates["fatigue_score"] = parsed.data.fatigueScore;
  if (parsed.data.burnoutTriggered !== undefined) updates["burnout_triggered"] = parsed.data.burnoutTriggered;
  updates["updated_at"] = new Date().toISOString();

  if (Object.keys(updates).length === 1) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "변경할 필드가 없습니다." } });
    return;
  }

  try {
    const sb = getSupabase();

    const { data, error } = await sb
      .from("character_runtime_states")
      .update(updates)
      .eq("character_id", id)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({
        ok: false,
        error: { code: "CHARACTER_NOT_FOUND", message: "캐릭터 런타임 상태를 찾을 수 없습니다.", details: { id } },
      });
      return;
    }

    // Broadcast runtime change to all SSE clients
    emitWorldEvent("runtime_update", {
      characterId: id,
      workload_score: (data as Record<string, unknown>)["workload_score"],
      fatigue_score: (data as Record<string, unknown>)["fatigue_score"],
      burnout_triggered: (data as Record<string, unknown>)["burnout_triggered"],
      activity_status: (data as Record<string, unknown>)["activity_status"],
    });

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[characters] runtime patch exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// POST /characters/:id/assign-task

charactersRouter.post("/:id/assign-task", async (req, res) => {
  const characterId = req.params["id"];
  const parsed = assignTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "taskId가 필요합니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { taskId, assignedByCharacterId, reason } = parsed.data;

  try {
    const sb = getSupabase();

    // Verify character exists
    const { data: character, error: charError } = await sb
      .from("characters")
      .select("id, active_mode, character_runtime_states(workload_score, burnout_triggered)")
      .eq("id", characterId)
      .single();

    if (charError || !character) {
      res.status(404).json({
        ok: false,
        error: { code: "CHARACTER_NOT_FOUND", message: "캐릭터를 찾을 수 없습니다.", details: { characterId } },
      });
      return;
    }

    // Verify task exists and fetch current state
    const { data: task, error: taskError } = await sb
      .from("tasks")
      .select("id, state, assignee_character_id")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      res.status(404).json({
        ok: false,
        error: { code: "TASK_NOT_FOUND", message: "태스크를 찾을 수 없습니다.", details: { taskId } },
      });
      return;
    }

    // Update task assignee and state
    const now = new Date().toISOString();
    const { data: updatedTask, error: updateError } = await sb
      .from("tasks")
      .update({ assignee_character_id: characterId, state: "Assigned", updated_at: now })
      .eq("id", taskId)
      .select()
      .single();

    if (updateError || !updatedTask) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "태스크 업데이트에 실패했습니다." } });
      return;
    }

    // Update character workload_score
    const runtimeRows = Array.isArray((character as Record<string, unknown>)["character_runtime_states"])
      ? ((character as Record<string, unknown>)["character_runtime_states"] as Array<{workload_score: number}>)
      : [(character as Record<string, unknown>)["character_runtime_states"] as {workload_score: number}];
    const currentWorkload = runtimeRows[0]?.workload_score ?? 0;
    await sb
      .from("character_runtime_states")
      .update({ workload_score: Math.min(100, currentWorkload + 10), updated_at: now })
      .eq("character_id", characterId);

    await writeEventLog(sb, {
      entityType: "task", entityId: taskId,
      eventType: "task.assigned",
      previousState: task.state as string, nextState: "Assigned",
      changedBy: assignedByCharacterId ?? req.auth?.sub ?? "system",
      reasonCode: "ASSIGNED",
      comment: reason ?? null,
      relatedTaskId: taskId,
    });

    res.json({ ok: true, data: updatedTask });
  } catch (err) {
    console.error("[characters] assign-task exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// ── POST /characters/:id/message ─────────────────────────────────────────────
// Founder → character direct message. Emits founder bubble + optional AI response.

const messageSchema = z.object({
  message: z.string().min(1).max(500),
});

charactersRouter.post("/:id/message", async (req, res) => {
  const charId = req.params["id"];
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "message 필드가 필요합니다." } });
    return;
  }

  const { message } = parsed.data;

  try {
    const sb = getSupabase();
    const { data: char, error } = await sb
      .from("characters")
      .select("id, name, code_name, ai_enabled, persona_summary")
      .eq("id", charId)
      .single();

    if (error || !char) {
      res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "캐릭터를 찾을 수 없습니다." } });
      return;
    }

    // Emit founder's message as a gold bubble on the character
    emitWorldEvent("character_bubble", {
      characterId: charId,
      bubbleType: "speech",
      text: message,
      isFounderMessage: true,
      duration: 10000,
    });

    emitWorldEvent("character_message", {
      characterId: charId,
      characterName: char.name,
      message,
      direction: "founder_to_char",
    });

    // Enqueue LLM reply job to worker (only if AI enabled)
    if ((char.ai_enabled as boolean) !== false) {
      void enqueueJob({
        queueName: QUEUE_NAMES.founderMessage,
        payload: { characterId: charId, message },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[characters] message exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." } });
  }
});

// GET /api/v1/characters/:id/memories
charactersRouter.get("/:id/memories", async (req, res) => {
  const charId = req.params["id"];
  const limit = Math.min(Number(req.query["limit"] ?? 20), 50);
  const sb = getSupabase();
  const { data, error } = await sb
    .from("character_memory_links")
    .select("relevance_score, memory_nodes(id, summary, memory_type, importance_score, created_at)")
    .eq("character_id", charId)
    .order("relevance_score", { ascending: false })
    .limit(limit);
  if (error) {
    res.json({ ok: true, data: [] });
    return;
  }
  const memories = (data ?? []).map((row: Record<string, unknown>) => {
    const node = row["memory_nodes"] as Record<string, unknown> | null;
    return {
      id: node?.["id"] as string,
      content: node?.["summary"] as string,
      memory_type: node?.["memory_type"] as string,
      importance: node?.["importance_score"] as number,
      created_at: node?.["created_at"] as string,
    };
  }).filter(m => m.id);
  res.json({ ok: true, data: memories });
});

// POST /api/v1/characters/:id/memories
charactersRouter.post("/:id/memories", async (req, res) => {
  const charId = req.params["id"];
  const { content, memory_type = "lesson", importance = 3 } = req.body as {
    content?: string; memory_type?: string; importance?: number;
  };
  if (!content || content.trim().length === 0) {
    res.status(400).json({ ok: false, error: { code: "BAD_REQUEST", message: "content is required" } });
    return;
  }
  const sb = getSupabase();
  const { data: node, error: e1 } = await sb.from("memory_nodes").insert({
    memory_scope: "character",
    scope_entity_id: charId,
    memory_type,
    summary: content.slice(0, 300),
    importance_score: Math.min(5, Math.max(1, importance)) / 5,
    token_size: Math.ceil(content.length / 4),
  }).select("id").single();
  if (e1 || !node) {
    res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: e1?.message } });
    return;
  }
  await sb.from("character_memory_links").insert({
    character_id: charId,
    memory_id: node.id,
    relevance_score: Math.min(5, Math.max(1, importance)) / 5,
  });
  res.status(201).json({ ok: true, data: { id: node.id } });
});

