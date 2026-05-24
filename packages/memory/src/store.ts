// Memory persistence — upsert, link, delete via Supabase (no-op in local profile)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { embedText, vectorToSql } from "./embed.js";

const IS_LOCAL = process.env["BLOKS_PROFILE"] !== "connected";

export type MemoryScope = "company" | "team" | "character" | "project";
export type MemoryType = "preference" | "lesson" | "warning" | "relationship" | "strategy";
export type DecayPolicy = "long" | "medium" | "short";
export type VisibilityLevel = "private" | "team" | "exec" | "company";

export interface MemoryNode {
  id: string;
  memory_scope: MemoryScope;
  scope_entity_id: string;
  memory_type: MemoryType;
  summary: string;
  importance_score: number;
  decay_policy: DecayPolicy;
  token_size: number;
  source_event_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMemoryInput {
  memoryScope: MemoryScope;
  scopeEntityId: string;
  memoryType: MemoryType;
  summary: string;
  importanceScore?: number | undefined;
  decayPolicy?: DecayPolicy | undefined;
  sourceEventId?: string | undefined;
  characterIds?: string[] | undefined;
  visibilityLevel?: VisibilityLevel | undefined;
}

export interface MemorySearchResult {
  memory_id: string;
  summary: string;
  memory_type: string;
  memory_scope: string;
  importance_score: number;
  similarity: number;
}

// ── Supabase singleton ────────────────────────────────────────────────────────

let _sb: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (IS_LOCAL) return null;
  if (_sb) return _sb;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

// ── Create memory ─────────────────────────────────────────────────────────────

export async function createMemory(input: CreateMemoryInput): Promise<MemoryNode> {
  const sb = getSupabase();
  if (!sb) throw new Error("[memory] createMemory not available in local profile");
  const now = new Date().toISOString();

  const embedding = await embedText(input.summary);
  const tokenSize = Math.ceil(input.summary.length / 4);

  const { data, error } = await sb
    .from("memory_nodes")
    .insert({
      memory_scope: input.memoryScope,
      scope_entity_id: input.scopeEntityId,
      memory_type: input.memoryType,
      summary: input.summary,
      embedding: vectorToSql(embedding),
      importance_score: input.importanceScore ?? 0.5,
      decay_policy: input.decayPolicy ?? "medium",
      token_size: tokenSize,
      source_event_id: input.sourceEventId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("id, memory_scope, scope_entity_id, memory_type, summary, importance_score, decay_policy, token_size, source_event_id, created_at, updated_at")
    .single();

  if (error || !data) throw new Error(`[memory] createMemory failed: ${error?.message}`);

  const memoryNode = data as MemoryNode;

  // Link to characters
  if (input.characterIds && input.characterIds.length > 0) {
    await linkMemoryToCharacters(memoryNode.id, input.characterIds, {
      visibilityLevel: input.visibilityLevel ?? "private",
    });
  }

  return memoryNode;
}

// ── Link memory to characters ─────────────────────────────────────────────────

export async function linkMemoryToCharacters(
  memoryId: string,
  characterIds: string[],
  opts: { relevanceScore?: number; visibilityLevel?: VisibilityLevel } = {}
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const rows = characterIds.map((characterId) => ({
    character_id: characterId,
    memory_id: memoryId,
    relevance_score: opts.relevanceScore ?? 1.0,
    visibility_level: opts.visibilityLevel ?? "private",
  }));

  await sb.from("character_memory_links").upsert(rows, { onConflict: "character_id,memory_id" });
}

// ── Semantic search ───────────────────────────────────────────────────────────

export async function searchMemories(opts: {
  characterId: string;
  query: string;
  topK?: number;
  threshold?: number;
}): Promise<MemorySearchResult[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const embedding = await embedText(opts.query);

  const { data, error } = await sb.rpc("match_memories", {
    p_character_id: opts.characterId,
    p_embedding: vectorToSql(embedding),
    p_match_count: opts.topK ?? 5,
    p_threshold: opts.threshold ?? 0.6,
  });

  if (error) {
    console.warn("[memory] searchMemories RPC error:", error.message);
    return [];
  }

  return (data as MemorySearchResult[]) ?? [];
}

export async function searchMemoriesByScope(opts: {
  scope: MemoryScope;
  scopeId: string;
  query: string;
  topK?: number;
  threshold?: number;
}): Promise<MemorySearchResult[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const embedding = await embedText(opts.query);

  const { data, error } = await sb.rpc("match_memories_by_scope", {
    p_scope: opts.scope,
    p_scope_id: opts.scopeId,
    p_embedding: vectorToSql(embedding),
    p_match_count: opts.topK ?? 5,
    p_threshold: opts.threshold ?? 0.6,
  });

  if (error) {
    console.warn("[memory] searchMemoriesByScope RPC error:", error.message);
    return [];
  }

  return (data as MemorySearchResult[]) ?? [];
}

// ── List memories ─────────────────────────────────────────────────────────────

export async function listCharacterMemories(
  characterId: string,
  opts: { limit?: number | undefined; memoryType?: MemoryType | undefined } = {}
): Promise<MemoryNode[]> {
  const sb = getSupabase();
  if (!sb) return [];

  let query = sb
    .from("character_memory_links")
    .select("memory_nodes(id, memory_scope, scope_entity_id, memory_type, summary, importance_score, decay_policy, token_size, created_at, updated_at)")
    .eq("character_id", characterId)
    .order("relevance_score", { ascending: false })
    .limit(opts.limit ?? 20);

  const { data } = await query;

  const nodes: MemoryNode[] = [];
  for (const row of data ?? []) {
    const node = (row as Record<string, unknown>)["memory_nodes"];
    if (node) {
      const n = Array.isArray(node) ? node[0] : node;
      if (n) {
        if (!opts.memoryType || (n as MemoryNode).memory_type === opts.memoryType) {
          nodes.push(n as MemoryNode);
        }
      }
    }
  }

  return nodes;
}

// ── Delete memory ─────────────────────────────────────────────────────────────

export async function deleteMemory(memoryId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("memory_nodes").delete().eq("id", memoryId);
}

// ── Auto-compression ──────────────────────────────────────────────────────────
// When a character has >threshold memories, summarize the oldest batch via LLM
// and replace them with a single "summary" memory node.
// Returns number of memories compressed (0 if nothing to do).

export async function compressCharacterMemories(
  characterId: string,
  opts: {
    threshold?: number;
    batchSize?: number;
    summarize: (texts: string[]) => Promise<string>;
  }
): Promise<number> {
  const { threshold = 30, batchSize = 20, summarize } = opts;
  const sb = getSupabase();
  if (!sb) return 0;

  // Count current memories
  const { count } = await sb
    .from("character_memory_links")
    .select("*", { count: "exact", head: true })
    .eq("character_id", characterId);

  if ((count ?? 0) <= threshold) return 0;

  // Fetch oldest batchSize memories (by created_at asc via join)
  const { data: linkRows } = await sb
    .from("character_memory_links")
    .select("memory_id, memory_nodes(id, summary, memory_type, importance_score, created_at)")
    .eq("character_id", characterId)
    .order("memory_nodes(created_at)", { ascending: true })
    .limit(batchSize);

  const nodes: MemoryNode[] = [];
  for (const row of linkRows ?? []) {
    const node = (row as Record<string, unknown>)["memory_nodes"];
    if (node) {
      const n = Array.isArray(node) ? node[0] : node;
      if (n) nodes.push(n as MemoryNode);
    }
  }

  if (nodes.length === 0) return 0;

  // Summarize via injected LLM function
  const texts = nodes.map(n => `[${n.memory_type}] ${n.summary}`);
  const summaryText = await summarize(texts);

  // Create new summary memory node
  const avgImportance = nodes.reduce((s, n) => s + n.importance_score, 0) / nodes.length;
  await createMemory({
    memoryScope: "character",
    scopeEntityId: characterId,
    memoryType: "lesson",
    summary: summaryText.slice(0, 500),
    importanceScore: Math.max(avgImportance, 0.6),
    decayPolicy: "long",
    characterIds: [characterId],
  });

  // Delete the original compressed memories
  const ids = nodes.map(n => n.id);
  await sb.from("memory_nodes").delete().in("id", ids);

  return ids.length;
}
