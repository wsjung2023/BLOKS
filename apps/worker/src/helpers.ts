// Worker shared helpers — agent messaging + reviewer lookup
import { getDb } from "@bloks/db";

export async function sendAgentMessage(opts: {
  fromCharId: string;
  toCharId: string;
  messageType: "REQUEST" | "RESPONSE" | "HANDOFF" | "REVIEW_REQUEST" | "FYI";
  content: string;
  relatedTaskId?: string;
  now: string;
}): Promise<void> {
  const sb = getDb();
  await sb.from("agent_messages").insert({
    from_char_id: opts.fromCharId,
    to_char_id: opts.toCharId,
    message_type: opts.messageType,
    content: opts.content,
    related_task_id: opts.relatedTaskId ?? null,
    status: "PENDING",
    created_at: opts.now,
  });
}

export async function findAvailableReviewer(
  excludeCharId: string,
  _projectId?: string,
): Promise<string | null> {
  const sb = getDb();
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
