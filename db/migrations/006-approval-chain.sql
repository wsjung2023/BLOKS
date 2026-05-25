-- Migration 006: multi-level approval chain
-- Adds current_level to track progress through L1→L2→L3→Founder chain

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS current_level TEXT NOT NULL DEFAULT 'L1';

-- Back-fill: existing Pending rows start at their required_level (single-level only was used before)
UPDATE approvals
  SET current_level = required_level
  WHERE state = 'Pending' AND current_level = 'L1' AND required_level = 'L0';
