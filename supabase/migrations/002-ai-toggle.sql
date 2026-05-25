-- Migration 002: add ai_enabled flag to characters
-- Allows per-character LLM call toggle to reduce API costs

ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT true;
