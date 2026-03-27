import { Router } from "express";
import { z } from "zod";
import { EventType } from "@bloks/shared";
import { getSupabase } from "@bloks/db";

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
    const sb = getSupabase();
    let query = sb
      .from("event_logs")
      .select("id, company_id, event_type, actor_id, target_type, target_id, payload, severity, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (projectId) query = query.contains("payload", { projectId });
    if (entityType) query = query.eq("target_type", entityType);
    if (eventType) query = query.eq("event_type", eventType);

    const { data, count, error } = await query;
    if (error) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR", message: "Event 로그 조회 중 오류가 발생했습니다." } });
      return;
    }

    res.json({ ok: true, data: { items: data ?? [], total: count ?? 0 } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다.", details: { message: String(err) } } });
  }
});
