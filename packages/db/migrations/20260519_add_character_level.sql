-- Migration: Add character level/experience system
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/oslooevfngnopphducql/sql/new

ALTER TABLE characters ADD COLUMN IF NOT EXISTS total_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS level_experience INTEGER NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS total_tasks_done INTEGER NOT NULL DEFAULT 0;
