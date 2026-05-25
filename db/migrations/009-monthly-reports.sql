-- Monthly reports table for automated cost and task summaries
CREATE TABLE IF NOT EXISTS monthly_reports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year                int  NOT NULL,
  month               int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_api_cost_usd  float NOT NULL DEFAULT 0,
  task_count          int   NOT NULL DEFAULT 0,
  completed_count     int   NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);
