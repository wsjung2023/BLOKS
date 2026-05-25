-- BLOKS 초기 스키마 생성 (Supabase SQL Editor에서 실행)

-- ENUMS
CREATE TYPE character_type AS ENUM ('AI_AGENT', 'HUMAN_FOUNDER', 'DIGITAL_TWIN');
CREATE TYPE active_mode AS ENUM ('ActiveCore', 'OnCall', 'Specialist');
CREATE TYPE character_activity_status AS ENUM ('Idle', 'Working', 'InMeeting', 'Overloaded', 'Burnout', 'Offline');
CREATE TYPE role_family_type AS ENUM ('Executive', 'Strategy', 'Marketing', 'Research', 'Engineering', 'Operations', 'Finance', 'Legal', 'HR', 'Design', 'Data', 'Security');
CREATE TYPE approval_level AS ENUM ('L0', 'L1', 'L2', 'L3', 'L4', 'L5');
CREATE TYPE project_state AS ENUM ('Draft', 'Active', 'OnHold', 'Completed', 'Cancelled');
CREATE TYPE task_state AS ENUM ('Backlog', 'Todo', 'InProgress', 'InReview', 'Blocked', 'Done', 'Cancelled');
CREATE TYPE approval_state AS ENUM ('Pending', 'Approved', 'Rejected', 'Escalated', 'Withdrawn');
CREATE TYPE priority AS ENUM ('Critical', 'High', 'Medium', 'Low');

-- COMPANIES
CREATE TABLE companies (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  world_tone TEXT DEFAULT 'CozyTactical',
  active_flag BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- DIVISIONS
CREATE TABLE divisions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  division_type role_family_type NOT NULL,
  head_character_id TEXT,
  sort_order INT DEFAULT 0,
  active_flag BOOLEAN DEFAULT true
);

-- DEPARTMENTS
CREATE TABLE departments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  division_id TEXT NOT NULL REFERENCES divisions(id),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  lead_character_id TEXT,
  active_flag BOOLEAN DEFAULT true,
  UNIQUE (division_id, code)
);

-- RANKS
CREATE TABLE ranks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  level INT UNIQUE NOT NULL,
  approval_ceiling TEXT DEFAULT 'L0',
  default_authority_score INT DEFAULT 0
);

-- MODEL PROFILES
CREATE TABLE model_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  profile_name TEXT NOT NULL,
  provider_name TEXT DEFAULT 'openai',
  primary_model TEXT NOT NULL,
  secondary_model TEXT,
  reasoning_depth TEXT DEFAULT 'mid',
  creativity_score FLOAT DEFAULT 50,
  reliability_score FLOAT DEFAULT 70,
  coding_score FLOAT DEFAULT 50,
  analysis_score FLOAT DEFAULT 50,
  max_budget_per_task FLOAT DEFAULT 0.5,
  tool_access_level TEXT DEFAULT 'limited',
  active_flag BOOLEAN DEFAULT true
);

-- ROLES
CREATE TABLE roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  department_id TEXT REFERENCES departments(id),
  name TEXT NOT NULL,
  family role_family_type NOT NULL,
  responsibility_summary TEXT,
  is_lead_role BOOLEAN DEFAULT false
);

-- CHARACTERS
CREATE TABLE characters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  code_name TEXT NOT NULL,
  division_id TEXT REFERENCES divisions(id),
  department_id TEXT REFERENCES departments(id),
  rank_id TEXT REFERENCES ranks(id),
  role_id TEXT REFERENCES roles(id),
  character_type character_type NOT NULL DEFAULT 'AI_AGENT',
  system_role_tags JSONB DEFAULT '[]',
  approval_level_limit approval_level DEFAULT 'L0',
  budget_limit_tier TEXT DEFAULT 'B0',
  persona_summary TEXT,
  core_drive TEXT,
  moral_filter TEXT,
  default_model_profile_id TEXT REFERENCES model_profiles(id),
  trust_base FLOAT DEFAULT 50,
  influence_base FLOAT DEFAULT 50,
  loyalty_base FLOAT DEFAULT 100,
  active_mode active_mode DEFAULT 'OnCall',
  avatar_uri TEXT,
  active_flag BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (company_id, code_name)
);

-- CHARACTER RUNTIME STATES
CREATE TABLE character_runtime_states (
  character_id TEXT PRIMARY KEY REFERENCES characters(id),
  activity_status character_activity_status DEFAULT 'Idle',
  location_zone TEXT,
  workload_score FLOAT DEFAULT 0,
  fatigue_score FLOAT DEFAULT 0,
  focus_score FLOAT DEFAULT 100,
  stress_score FLOAT DEFAULT 0,
  burnout_triggered BOOLEAN DEFAULT false,
  reliability_live FLOAT DEFAULT 100,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- PROJECTS
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  description TEXT,
  state project_state DEFAULT 'Draft',
  priority priority DEFAULT 'Medium',
  owner_id TEXT REFERENCES characters(id),
  requester_id TEXT REFERENCES characters(id),
  budget_allocated FLOAT DEFAULT 0,
  budget_used FLOAT DEFAULT 0,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TASKS
CREATE TABLE tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES projects(id),
  department_id TEXT REFERENCES departments(id),
  title TEXT NOT NULL,
  description TEXT,
  state task_state DEFAULT 'Backlog',
  priority priority DEFAULT 'Medium',
  assignee_id TEXT REFERENCES characters(id),
  reviewer_id TEXT REFERENCES characters(id),
  ai_output TEXT,
  cost_used FLOAT DEFAULT 0,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- APPROVALS
CREATE TABLE approvals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  approver_id TEXT REFERENCES characters(id),
  state approval_state DEFAULT 'Pending',
  required_level approval_level DEFAULT 'L1',
  reason_code TEXT,
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EVENT LOGS
CREATE TABLE event_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL REFERENCES companies(id),
  event_type TEXT NOT NULL,
  actor_id TEXT REFERENCES characters(id),
  target_type TEXT,
  target_id TEXT,
  payload JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'INFO',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PROMPT TEMPLATES
CREATE TABLE prompt_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  role_id TEXT REFERENCES roles(id),
  character_id TEXT REFERENCES characters(id),
  task_type TEXT NOT NULL,
  template_body TEXT NOT NULL,
  version INT DEFAULT 1,
  active_flag BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE character_runtime_states;
ALTER PUBLICATION supabase_realtime ADD TABLE event_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

SELECT 'BLOKS schema created successfully!' as result;
