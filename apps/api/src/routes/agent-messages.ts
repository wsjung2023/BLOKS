import { Router } from "express";
import { z } from "zod";
import { getDb } from "@bloks/db";
import { emitWorldEvent } from "./stream.js";

export const agentMessagesRouter = Router();

const createSchema = z.object({
  fromCharId: z.string().uuid(),
  toCharId: z.string().uuid(),
  messageType: z.enum(["REQUEST", "RESPONSE", "HANDOFF", "REVIEW_REQUEST", "FYI"]),
  content: z.string().min(1).max(1000),
  relatedTaskId: z.string().uuid().optional(),
});

agentMessagesRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ ok: false, error: { code: "VALIDATION_ERROR", message: "입력값이 올바르지 않습니다." } });
    return;
  }
  try {
    const sb = getDb();
    const { data, error } = await sb.from("agent_messages").insert({
      from_char_id: parsed.data.fromCharId,
      to_char_id: parsed.data.toCharId,
      message_type: parsed.data.messageType,
      content: parsed.data.content,
      related_task_id: parsed.data.relatedTaskId ?? null,
    }).select().single();
    if (error || !data) {
      res.status(500).json({ ok: false, error: { code: "DB_ERROR" } });
      return;
    }
    emitWorldEvent("agent_message", {
      fromCharId: parsed.data.fromCharId,
      toCharId: parsed.data.toCharId,
      messageType: parsed.data.messageType,
      content: parsed.data.content,
      relatedTaskId: parsed.data.relatedTaskId ?? null,
    });
    res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error("[agent-messages] exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});

agentMessagesRouter.get("/", async (req, res) => {
  const toCharId = req.query["toCharId"] as string | undefined;
  try {
    const sb = getDb();
    let query = sb.from("agent_messages").select("*").order("created_at", { ascending: false }).limit(50);
    if (toCharId) query = query.eq("to_char_id", toCharId);
    const { data, error } = await query;
    if (error) { res.status(500).json({ ok: false, error: { code: "DB_ERROR" } }); return; }
    res.json({ ok: true, data: { items: data ?? [] } });
  } catch (err) {
    console.error("[agent-messages] list exception", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR" } });
  }
});
