-- Request metrics table for P95 latency and failure rate tracking
CREATE TABLE IF NOT EXISTS request_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method      text NOT NULL,
  path        text NOT NULL,
  status_code int  NOT NULL,
  duration_ms int  NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_request_metrics_path_time
  ON request_metrics (path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_request_metrics_time
  ON request_metrics (created_at DESC);
