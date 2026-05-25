CREATE TABLE IF NOT EXISTS agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_char_id uuid REFERENCES characters(id),
  to_char_id uuid REFERENCES characters(id),
  message_type text NOT NULL CHECK (message_type IN ('REQUEST','RESPONSE','HANDOFF','REVIEW_REQUEST','FYI')),
  content text NOT NULL,
  related_task_id uuid REFERENCES tasks(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','READ','ACTED_ON')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_messages_to_char_idx ON agent_messages(to_char_id);
