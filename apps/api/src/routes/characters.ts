// Characters routes ??GET/PATCH/POST for /api/v1/characters with Supabase
import { Router } from "express";
import { z } from "zod";
import { getSupabase } from "@bloks/db";

export const charactersRouter = Router();

// ?? Query schemas ??????????????????????????????????????????????????????????????

const listQuerySchema = z.object({
  division: z.string().optional(),
  status: z.string().optional(),
  activeMode: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const runtimePatchSchema = z.object({
  workloadScore: z.number().min(0).max(100).optional(),
  fatigueScore: z.number().min(0).max(100).optional(),
  burnoutTriggered: z.boolean().optional(),
});

const assignTaskSchema = z.object({
  taskId: z.string().min(1),
  assignedByCharacterId: z.string().optional(),
  reason: z.string().max(500).optional(),
});

// ?? GET /characters ????????????????????????????????????????????????????????????

charactersRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "?섎せ??荑쇰━ ?뚮씪誘명꽣?낅땲??", details: parsed.error.flatten() },
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
      .select(`id, name, code_name, active_mode, active_flag, trust_base, influence_base, persona_summary, division_id, department_id, rank_id, role_id, character_runtime_states(activity_status, workload_score, fatigue_score, burnout_triggered)`,
        { count: "exact" }
      )
      .range(from, to);

    if (division) query = query.eq("divisions.code", division);
    if (activeMode) query = query.eq("active_mode", activeMode);
    if (status) {
      // runtime_status lives in character_runtime_states join
      query = query.eq("character_runtime_states.runtime_status", status);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error("[characters] list error", error);
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "DB 議고쉶 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." } });
      return;
    }

    res.json({
      ok: true,
      data: {
        items: data ?? [],
        page,
        pageSize,
        total: count ?? 0,
      },
    });
  } catch (err) {
    console.error("[characters] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." } });
  }
});

// ?? GET /characters/:id ????????????????????????????????????????????????????????

charactersRouter.get("/:id", async (req, res) => {
  const id = req.params["id"];
  if (!id) {
    res.status(400).json({ ok: false, error: { code: "INVALID_PARAM", message: "ID媛 ?꾩슂?⑸땲??" } });
    return;
  }

  try {
    const sb = getSupabase();

    const { data, error } = await sb
      .from("characters")
      .select(`id, name, code_name, active_mode, active_flag, trust_base, influence_base, persona_summary, division_id, department_id, rank_id, role_id, character_runtime_states(activity_status, workload_score, fatigue_score, burnout_triggered)`
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      res.status(404).json({
        ok: false,
        error: { code: "CHARACTER_NOT_FOUND", message: "罹먮┃?곕? 李얠쓣 ???놁뒿?덈떎.", details: { id } },
      });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[characters] detail exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." } });
  }
});

// ?? PATCH /characters/:id/runtime ?????????????????????????????????????????????

charactersRouter.patch("/:id/runtime", async (req, res) => {
  const id = req.params["id"];
  const parsed = runtimePatchSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "?낅젰媛믪씠 ?щ컮瑜댁? ?딆뒿?덈떎.", details: parsed.error.flatten() },
    });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.workloadScore !== undefined) updates["workload_score"] = parsed.data.workloadScore;
  if (parsed.data.fatigueScore !== undefined) updates["fatigue_score"] = parsed.data.fatigueScore;
  if (parsed.data.burnoutTriggered !== undefined) updates["burnout_triggered"] = parsed.data.burnoutTriggered;
  updates["updated_at"] = new Date().toISOString();

  if (Object.keys(updates).length === 1) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "蹂寃쏀븷 ?꾨뱶媛 ?놁뒿?덈떎." } });
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
        error: { code: "CHARACTER_NOT_FOUND", message: "罹먮┃???고????곹깭瑜?李얠쓣 ???놁뒿?덈떎.", details: { id } },
      });
      return;
    }

    res.json({ ok: true, data });
  } catch (err) {
    console.error("[characters] runtime patch exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." } });
  }
});

// ?? POST /characters/:id/assign-task ??????????????????????????????????????????

charactersRouter.post("/:id/assign-task", async (req, res) => {
  const characterId = req.params["id"];
  const parsed = assignTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "taskId媛 ?꾩슂?⑸땲??", details: parsed.error.flatten() },
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
        error: { code: "CHARACTER_NOT_FOUND", message: "罹먮┃?곕? 李얠쓣 ???놁뒿?덈떎.", details: { characterId } },
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
        error: { code: "TASK_NOT_FOUND", message: "?쒖뒪?щ? 李얠쓣 ???놁뒿?덈떎.", details: { taskId } },
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
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "?쒖뒪???낅뜲?댄듃???ㅽ뙣?덉뒿?덈떎." } });
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

    // Log event
    await sb.from("event_logs").insert({
      entity_type: "task",
      entity_id: taskId,
      event_type: "task.assigned",
      previous_state: task.state,
      next_state: "Assigned",
      changed_by: assignedByCharacterId ?? req.auth?.sub ?? "system",
      changed_at: now,
      reason_code: "ASSIGNED",
      comment: reason ?? null,
      related_task_id: taskId,
    });

    res.json({ ok: true, data: updatedTask });
  } catch (err) {
    console.error("[characters] assign-task exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "?쒕쾭 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." } });
  }
});


