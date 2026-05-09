-- ============================================================================
-- BLOKS Schema Migration 001: Code ↔ DB 동기화
-- ============================================================================
-- 이 마이그레이션은 코드에서 사용하는 컬럼/enum과 실제 DB 스키마의 불일치를 해소합니다.
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================================

-- ── 1. task_state enum 확장 ──────────────────────────────────────────────────
-- SQL 기존: Backlog, Todo, InProgress, InReview, Blocked, Done, Cancelled (7개)
-- 코드 사용: Draft, Created, Assigned, Accepted, InProgress, PendingReview,
--            Rejected, Rework, Approved, Done, Blocked, Cancelled (12개)

-- 새 값 추가 (기존 값은 유지)
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Draft';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Created';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Assigned';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Accepted';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'PendingReview';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Rejected';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Rework';
ALTER TYPE task_state ADD VALUE IF NOT EXISTS 'Approved';

-- ── 2. tasks 테이블: assignee_id → assignee_character_id 리네임 ──────────────
-- 코드는 일관적으로 assignee_character_id를 사용합니다.

-- 2a. assignee_id 컬럼이 존재하면 리네임
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'assignee_id'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN assignee_id TO assignee_character_id;
    RAISE NOTICE 'Renamed: assignee_id → assignee_character_id';
  ELSE
    RAISE NOTICE 'assignee_character_id already exists or assignee_id not found';
  END IF;
END $$;

-- 2b. reviewer_id → reviewer_character_id (같은 패턴)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'reviewer_id'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN reviewer_id TO reviewer_character_id;
    RAISE NOTICE 'Renamed: reviewer_id → reviewer_character_id';
  ELSE
    RAISE NOTICE 'reviewer_character_id already exists or reviewer_id not found';
  END IF;
END $$;

-- ── 3. tasks 테이블: 코드에서 사용하지만 없을 수 있는 컬럼 추가 ──────────────

-- task_type: 태스크 유형 (AI 라우팅에 사용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'task_type'
  ) THEN
    ALTER TABLE tasks ADD COLUMN task_type TEXT;
    RAISE NOTICE 'Added: tasks.task_type';
  END IF;
END $$;

-- parent_task_id: 하위 태스크 참조
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN parent_task_id TEXT REFERENCES tasks(id);
    RAISE NOTICE 'Added: tasks.parent_task_id';
  END IF;
END $$;

-- due_at: 코드에서 due_at 사용 (SQL은 due_date)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_date'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_at'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN due_date TO due_at;
    RAISE NOTICE 'Renamed: due_date → due_at';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'due_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN due_at TIMESTAMPTZ;
    RAISE NOTICE 'Added: tasks.due_at';
  END IF;
END $$;

-- ── 4. character_runtime_states: current_task_count 컬럼 ─────────────────────
-- 틱 엔진이 이 값을 SSE로 브로드캐스트하지만 DB에 저장할 수도 있음

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'character_runtime_states' AND column_name = 'current_task_count'
  ) THEN
    ALTER TABLE character_runtime_states ADD COLUMN current_task_count INT DEFAULT 0;
    RAISE NOTICE 'Added: character_runtime_states.current_task_count';
  END IF;
END $$;

-- ── 5. characters 테이블: active_flag가 없으면 추가 ──────────────────────────
-- (대부분 이미 있지만 안전 장치)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'characters' AND column_name = 'active_flag'
  ) THEN
    ALTER TABLE characters ADD COLUMN active_flag BOOLEAN DEFAULT true;
    RAISE NOTICE 'Added: characters.active_flag';
  END IF;
END $$;

-- ── 6. tasks 테이블: department_id가 없으면 추가 ─────────────────────────────
-- 틱 엔진의 자동 배정에서 department_id 기반 매칭에 사용

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN department_id TEXT REFERENCES departments(id);
    RAISE NOTICE 'Added: tasks.department_id';
  END IF;
END $$;

-- ── 7. event_logs: entity_type/entity_id 패턴 확인 ───────────────────────────
-- 코드에서 entity_type, entity_id를 사용하는데 SQL에는 target_type, target_id
-- 둘 다 있도록 보장

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_logs' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE event_logs ADD COLUMN entity_type TEXT;
    RAISE NOTICE 'Added: event_logs.entity_type';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_logs' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE event_logs ADD COLUMN entity_id TEXT;
    RAISE NOTICE 'Added: event_logs.entity_id';
  END IF;
END $$;

-- ── 완료 ─────────────────────────────────────────────────────────────────────

SELECT 'Migration 001 completed successfully!' AS result;
