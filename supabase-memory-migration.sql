-- BLOKS Memory RAG Migration
-- Run this in Supabase SQL Editor (or via psql)
-- Requires: pgvector extension (enabled by default on Supabase)

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ── memory_nodes ─────────────────────────────────────────────────────────────
-- Core memory store with semantic embedding for RAG

CREATE TABLE IF NOT EXISTS memory_nodes (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memory_scope     TEXT NOT NULL CHECK (memory_scope IN ('company','team','character','project')),
  scope_entity_id  TEXT NOT NULL,
  memory_type      TEXT NOT NULL CHECK (memory_type IN ('preference','lesson','warning','relationship','strategy')),
  summary          TEXT NOT NULL,
  embedding        vector(1536),          -- OpenAI text-embedding-3-small
  importance_score FLOAT DEFAULT 0.5,
  decay_policy     TEXT DEFAULT 'medium' CHECK (decay_policy IN ('long','medium','short')),
  token_size       INT DEFAULT 0,
  source_event_id  TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- IVFFlat index for fast approximate nearest-neighbor search
-- Re-create with higher lists value once you have >1000 memories
CREATE INDEX IF NOT EXISTS memory_nodes_embedding_idx
  ON memory_nodes
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX IF NOT EXISTS memory_nodes_scope_idx
  ON memory_nodes (memory_scope, scope_entity_id);

-- ── character_memory_links ────────────────────────────────────────────────────
-- Maps memories to characters with relevance scores

CREATE TABLE IF NOT EXISTS character_memory_links (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id     TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  memory_id        TEXT NOT NULL REFERENCES memory_nodes(id) ON DELETE CASCADE,
  relevance_score  FLOAT DEFAULT 1.0,
  visibility_level TEXT DEFAULT 'private' CHECK (visibility_level IN ('private','team','exec','company')),
  UNIQUE(character_id, memory_id)
);

CREATE INDEX IF NOT EXISTS character_memory_links_char_idx
  ON character_memory_links (character_id);

-- ── pgvector similarity search function ──────────────────────────────────────
-- Usage: SELECT * FROM match_memories('character-uuid', '[0.1, 0.2, ...]'::vector, 5, 0.7)

CREATE OR REPLACE FUNCTION match_memories(
  p_character_id  TEXT,
  p_embedding     vector(1536),
  p_match_count   INT DEFAULT 5,
  p_threshold     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  memory_id        TEXT,
  summary          TEXT,
  memory_type      TEXT,
  memory_scope     TEXT,
  importance_score FLOAT,
  similarity       FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    mn.id            AS memory_id,
    mn.summary,
    mn.memory_type,
    mn.memory_scope,
    mn.importance_score,
    1 - (mn.embedding <=> p_embedding) AS similarity
  FROM memory_nodes mn
  JOIN character_memory_links cml ON cml.memory_id = mn.id
  WHERE cml.character_id = p_character_id
    AND mn.embedding IS NOT NULL
    AND 1 - (mn.embedding <=> p_embedding) >= p_threshold
  ORDER BY mn.embedding <=> p_embedding
  LIMIT p_match_count;
$$;

-- ── Global (non-character) memory search function ────────────────────────────
-- Search all memories in a given scope (e.g., company memories)

CREATE OR REPLACE FUNCTION match_memories_by_scope(
  p_scope         TEXT,
  p_scope_id      TEXT,
  p_embedding     vector(1536),
  p_match_count   INT DEFAULT 5,
  p_threshold     FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  memory_id        TEXT,
  summary          TEXT,
  memory_type      TEXT,
  importance_score FLOAT,
  similarity       FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id               AS memory_id,
    summary,
    memory_type,
    importance_score,
    1 - (embedding <=> p_embedding) AS similarity
  FROM memory_nodes
  WHERE memory_scope = p_scope
    AND scope_entity_id = p_scope_id
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_match_count;
$$;
