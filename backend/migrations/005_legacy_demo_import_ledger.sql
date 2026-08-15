-- One-time, source-scoped audit ledger for the approved legacy demo import.
-- This records only mapping metadata and fingerprints; source credentials,
-- password material, sessions and Supabase asset URLs never belong here.

CREATE TABLE legacy_content_imports (
  id bigserial PRIMARY KEY,
  source_system text NOT NULL,
  source_entity text NOT NULL,
  source_id text NOT NULL,
  target_entity text,
  target_id text,
  content_sha256 text NOT NULL,
  status text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legacy_content_imports_source_system_length CHECK (char_length(btrim(source_system)) BETWEEN 1 AND 120),
  CONSTRAINT legacy_content_imports_source_entity_length CHECK (char_length(btrim(source_entity)) BETWEEN 1 AND 120),
  CONSTRAINT legacy_content_imports_source_id_length CHECK (char_length(btrim(source_id)) BETWEEN 1 AND 200),
  CONSTRAINT legacy_content_imports_target_entity_length CHECK (target_entity IS NULL OR char_length(btrim(target_entity)) BETWEEN 1 AND 120),
  CONSTRAINT legacy_content_imports_target_id_length CHECK (target_id IS NULL OR char_length(btrim(target_id)) BETWEEN 1 AND 200),
  CONSTRAINT legacy_content_imports_checksum CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT legacy_content_imports_status CHECK (status IN ('imported', 'deferred')),
  CONSTRAINT legacy_content_imports_target_for_imported CHECK (
    (status = 'imported' AND target_entity IS NOT NULL AND target_id IS NOT NULL)
    OR (status = 'deferred' AND target_entity IS NULL AND target_id IS NULL)
  ),
  CONSTRAINT legacy_content_imports_unique_source UNIQUE (source_system, source_entity, source_id)
);

CREATE INDEX legacy_content_imports_status_time
  ON legacy_content_imports (source_system, status, updated_at DESC);

CREATE TRIGGER legacy_content_imports_touch_updated_at
BEFORE UPDATE ON legacy_content_imports
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();
