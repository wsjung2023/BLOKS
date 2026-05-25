-- Migration 004: character long-term memory
-- Stores compressed, importance-ranked memories per character.
-- Injected into AI prompts (top 8 by importance/recency, ~400 tokens max).

CREATE TABLE IF NOT EXISTS character_memories (
  id          TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  character_id TEXT       NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) <= 300),
  memory_type TEXT        NOT NULL DEFAULT 'interaction'
                          CHECK (memory_type IN ('interaction','task_result','summary','founder_note')),
  importance  SMALLINT    NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  token_est   SMALLINT    NOT NULL DEFAULT 50,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_char_memories_lookup
  ON character_memories (character_id, importance DESC, created_at DESC);
