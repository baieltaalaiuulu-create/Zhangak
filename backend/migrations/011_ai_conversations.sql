CREATE TABLE ai_consents (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_consents_state CHECK ((accepted_at IS NOT NULL AND revoked_at IS NULL) OR (accepted_at IS NULL AND revoked_at IS NOT NULL))
);

CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_conversations_user_updated ON ai_conversations (user_id, updated_at DESC);
CREATE TRIGGER ai_conversations_touch_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TABLE ai_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE RESTRICT,
  role text NOT NULL,
  content text NOT NULL,
  provider text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_messages_role CHECK (role IN ('user', 'assistant')),
  CONSTRAINT ai_messages_content_length CHECK (char_length(content) BETWEEN 1 AND 4000)
);
CREATE INDEX ai_messages_conversation_time ON ai_messages (conversation_id, created_at DESC, id DESC);
