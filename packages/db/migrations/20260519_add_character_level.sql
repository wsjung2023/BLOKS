-- Migration: Add character level/experience system
-- Run this in your local Postgres or DB SQL editor

ALTER TABLE characters ADD COLUMN IF NOT EXISTS total_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS level_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS total_tasks_done INTEGER NOT NULL DEFAULT 0;
