CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  session_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(btrim(email))),
  CONSTRAINT users_email_length CHECK (char_length(email) BETWEEN 3 AND 254)
);

CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  student_type text,
  phone text,
  target_score integer,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_name_length CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 200),
  CONSTRAINT profiles_role CHECK (role IN (
    'student', 'teacher', 'manager', 'director', 'finance', 'admin_jr',
    'admin', 'super_admin', 'math_student', 'math_parent', 'math_admin'
  )),
  CONSTRAINT profiles_student_type CHECK (student_type IS NULL OR student_type IN ('online', 'offline', 'both')),
  CONSTRAINT profiles_target_score CHECK (target_score IS NULL OR target_score BETWEEN 0 AND 245)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  rotated_from uuid REFERENCES auth_sessions(id) ON DELETE SET NULL,
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_sessions_user_active ON auth_sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE auth_login_attempts (
  id bigserial PRIMARY KEY,
  bucket_hash text NOT NULL,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_login_attempts_bucket_time ON auth_login_attempts (bucket_hash, attempted_at DESC);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_time ON audit_log (actor_user_id, created_at DESC);
