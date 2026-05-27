import { Router } from "express";
import { z } from "zod";
import { EventType } from "@bloks/shared";
import type { EventLogRecord } from "@bloks/shared";
import { getDb } from "@bloks/db";

export const eventsRouter = Router();

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  entityType: z.string().optional(),
  eventType: z.nativeEnum(EventType).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

eventsRouter.get("/", async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: { code: "INVALID_QUERY", message: "잘못된 쿼리 파라미터입니다.", details: parsed.error.flatten() },
    });
    return;
  }

  const { projectId, entityType, eventType, limit } = parsed.data;
  try {
    const sb = getDb();
    let query = sb
      .from("event_logs")
      .select("id, entity_type, entity_id, event_type, previous_state, next_state, changed_by, changed_at, reason_code, comment, related_project_id, related_task_id", { count: "exact" })
      .order("changed_at", { ascending: false })
      .limit(limit);

    if (projectId) query = query.eq("related_project_id", projectId);
    if (entityType) query = query.eq("entity_type", entityType);
    if (eventType) query = query.eq("event_type", eventType);

    const { data, count, error } = await query;
    const items = (data ?? []) as EventLogRecord[];
    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Event 로그 조회 중 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items, total: count ?? 0 } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});
