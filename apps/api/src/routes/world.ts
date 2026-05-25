// GET /api/v1/world/snapshot — lightweight character world-state dump
// Companion to the SSE stream: used for initial load and periodic reconciliation.
import { Router, type Request, type Response } from "express";
import { getDb } from "@bloks/db";

export const worldRouter = Router();

// ── GET /api/v1/world/snapshot ─────────────────────────────────────────────────
// Returns all characters with their current runtime state.
// Designed for 2–5 s polling cadence per design spec (doc 10 + doc 11).

worldRouter.get("/snapshot", async (_req: Request, res: Response) => {
  try {
    const sb = getDb();

    const { data, error } = await sb
      .from("characters")
      .select(
        `id, name, code_name, active_flag, active_mode, division_id,
         divisions(division_type),
         character_runtime_states(
           activity_status,
           workload_score, fatigue_score, burnout_triggered,
           updated_at
         )`
      )
      .eq("active_flag", true)
      .order("name");

    if (error) {
      console.error("[world/snapshot] DB error:", error.message);
      return res.status(500).json({
        ok: false,
        error: { code: "DB_ERROR", message: error.message },
      });
    }

    const characters = (data ?? []).map((char: Record<string, unknown>) => {
      const rs = Array.isArray(char.character_runtime_states)
        ? char.character_runtime_states[0]
        : char.character_runtime_states;

      return {
        id: char.id,
        name: char.name,
        code_name: char.code_name,
        active_mode: char.active_mode,
        division_type: (Array.isArray(char.divisions)
          ? (char.divisions[0] as { division_type: string } | undefined)?.division_type
          : (char.divisions as { division_type: string } | null)?.division_type) ?? null,
        activity_status: rs?.activity_status ?? "Idle",
        workload_score: rs?.workload_score ?? 0,
        fatigue_score: rs?.fatigue_score ?? 0,
        burnout_triggered: rs?.burnout_triggered ?? false,
        state_updated_at: rs?.updated_at ?? null,
      };
    });

    return res.json({
      ok: true,
      data: {
        characters,
        total: characters.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[world/snapshot] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "스냅샷 생성 중 오류가 발생했습니다." },
    });
  }
});
