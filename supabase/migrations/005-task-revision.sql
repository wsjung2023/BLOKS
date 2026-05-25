-- 태스크 수정 이력 추적 컬럼
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_history JSONB NOT NULL DEFAULT '[]'::jsonb;
