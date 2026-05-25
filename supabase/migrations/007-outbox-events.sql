-- outbox_events: write-ahead log for BullMQ job publishing.
-- Guarantees at-least-once delivery even if the worker/Redis restarts mid-flight.
CREATE TABLE IF NOT EXISTS outbox_events (
  id                        text        PRIMARY KEY,
  idempotency_key           text        UNIQUE,
  queue_name                text        NOT NULL,
  payload                   jsonb       NOT NULL DEFAULT '{}',
  requested_by_character_id text,
  trace_id                  text,
  published_at              timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Relay phase polls this index: unpublished rows older than 1 minute
CREATE INDEX IF NOT EXISTS outbox_events_relay_idx
  ON outbox_events(created_at)
  WHERE published_at IS NULL;
