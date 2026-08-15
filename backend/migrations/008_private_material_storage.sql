-- Private lesson-material storage metadata. Object bytes live outside the
-- public web root; this table is the audited source of access control.

ALTER TABLE lesson_materials
  ADD COLUMN scan_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN scanned_at timestamptz,
  ADD COLUMN scanned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN original_filename text,
  ADD COLUMN content_sha256 text;

ALTER TABLE lesson_materials
  ADD CONSTRAINT lesson_materials_scan_status CHECK (scan_status IN ('pending', 'clean', 'rejected')),
  ADD CONSTRAINT lesson_materials_scan_state CHECK (
    (scan_status = 'pending' AND scanned_at IS NULL AND scanned_by IS NULL)
    OR (scan_status IN ('clean', 'rejected') AND scanned_at IS NOT NULL AND scanned_by IS NOT NULL)
  ),
  ADD CONSTRAINT lesson_materials_original_filename_length CHECK (
    original_filename IS NULL OR char_length(original_filename) BETWEEN 1 AND 255
  ),
  ADD CONSTRAINT lesson_materials_content_sha256 CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  );

CREATE UNIQUE INDEX lesson_materials_storage_key_unique
  ON lesson_materials (storage_key)
  WHERE storage_key IS NOT NULL;

CREATE INDEX lesson_materials_lesson_scan_position
  ON lesson_materials (lesson_id, scan_status, position);
