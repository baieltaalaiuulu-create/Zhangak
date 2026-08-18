-- Web Push subscriptions are private server-side credentials. They are bound
-- to an active auth session so a logout/revocation also stops delivery on a
-- shared device without relying on browser cleanup.

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  endpoint_hash bytea NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth_secret text NOT NULL,
  user_agent text,
  lesson_reminders boolean NOT NULL DEFAULT true,
  result_notifications boolean NOT NULL DEFAULT true,
  announcement_notifications boolean NOT NULL DEFAULT true,
  revoked_at timestamptz,
  last_tested_at timestamptz,
  last_reminder_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint ~ '^https://'),
  CONSTRAINT push_subscriptions_endpoint_length CHECK (char_length(endpoint) BETWEEN 16 AND 2048),
  CONSTRAINT push_subscriptions_p256dh_length CHECK (char_length(p256dh) BETWEEN 32 AND 256),
  CONSTRAINT push_subscriptions_auth_length CHECK (char_length(auth_secret) BETWEEN 8 AND 128)
);

CREATE INDEX push_subscriptions_user_active
  ON push_subscriptions (user_id, session_id, updated_at DESC)
  WHERE revoked_at IS NULL;

