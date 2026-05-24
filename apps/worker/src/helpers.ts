// Worker shared helpers — agent messaging + reviewer lookup
import { getSupabase } from "@bloks/db";
import Redis from "ioredis";

const WORLD_EVENTS_CHANNEL = "world:events";

let _redisPub: Redis | null = null;
function getRedisPub(): Redis {
  if (_redisPub) return _redisPub;
  _redisPub = new Redis({
    host: process.env["REDIS_HOST"] ?? "127.0.0.1",
    port: Number(process.env["REDIS_PORT"] ?? 6379),
    password: process.env["REDIS_PASSWORD"] || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });
  _redisPub.connect().catch(() => {});
  return _redisPub;
}

export async function sendAgentMessage(opts: {
  fromCharId: string;
  toCharId: string;
  messageType: "REQUEST" | "RESPONSE" | "HANDOFF" | "REVIEW_REQUEST" | "FYI";
  content: string;
  relatedTaskId?: string;
  now: string;
}): Promise<void> {
  const sb = getSupabase();
  await sb.from("agent_messages").insert({
    from_char_id: opts.fromCharId,
    to_char_id: opts.toCharId,
    message_type: opts.messageType,
    content: opts.content,
    related_task_id: opts.relatedTaskId ?? null,
    status: "PENDING",
    created_at: opts.now,
  });
  try {
    await getRedisPub().publish(
      WORLD_EVENTS_CHANNEL,
      JSON.stringify({
        type: "agent_message",
        payload: {
          fromCharId: opts.fromCharId,
          toCharId: opts.toCharId,
          messageType: opts.messageType,
          content: opts.content,
          relatedTaskId: opts.relatedTaskId ?? null,
        },
        timestamp: opts.now,
      }),
    );
  } catch {
    // Non-fatal
  }
}

export async function findAvailableReviewer(
  excludeCharId: string,
  _projectId?: string,
): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("character_runtime_states")
    .select("character_id, workload_score")
    .neq("character_id", excludeCharId)
    .lt("workload_score", 70)
    .eq("burnout_triggered", false)
    .order("workload_score", { ascending: true })
    .limit(1)
    .single();
  return (data?.character_id as string | undefined) ?? null;
}
