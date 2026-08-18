-- Lesson video v1 hardening.
--
-- Before this migration the only stored video reference was a free-form URL
-- (`lessons.content_url`, `lesson_materials.external_url`) validated by a host
-- prefix. That accepted playlists, shorts, live streams and channel pages, and
-- it forced every read path to re-parse an operator-supplied string.
--
-- This migration introduces the canonical reference: a verified 11-character
-- YouTube video id stored beside the URL. The id is what the student video
-- session returns; the raw URL stays server-side.
--
-- Scope note, deliberately recorded next to the schema: an id is an access
-- key for the *lesson*, not a DRM token for the *video*. Any browser allowed
-- to play the video necessarily receives the id. See
-- docs/operations/lesson-video.md.

ALTER TABLE lesson_materials
  ADD COLUMN video_id text,
  ADD CONSTRAINT lesson_materials_video_id_shape
    CHECK (video_id IS NULL OR video_id ~ '^[A-Za-z0-9_-]{11}$'),
  -- Only a video row may carry a video id. A PDF that somehow acquired one
  -- would otherwise be playable through the video session route.
  ADD CONSTRAINT lesson_materials_video_id_type
    CHECK (video_id IS NULL OR material_type = 'video');

ALTER TABLE lessons
  ADD COLUMN video_id text,
  ADD CONSTRAINT lessons_video_id_shape
    CHECK (video_id IS NULL OR video_id ~ '^[A-Za-z0-9_-]{11}$');

-- Backfill only unambiguous single-video references. A row holding a
-- playlist, a live URL or anything else this cannot decode keeps a NULL
-- video id: it stops being playable and has to be re-entered by an
-- administrator through the validated admin route. Silently guessing an id
-- for such a row is what would publish unreviewed content.
UPDATE lesson_materials
   SET video_id = COALESCE(
         substring(external_url from '^https://(?:www\.|m\.)?youtube\.com/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:&|$)'),
         substring(external_url from '^https://youtu\.be/([A-Za-z0-9_-]{11})(?:\?|$)'),
         substring(external_url from '^https://(?:www\.)?youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})(?:\?|$)')
       )
 WHERE material_type = 'video'
   AND external_url IS NOT NULL
   AND position('list=' in external_url) = 0;

UPDATE lessons
   SET video_id = COALESCE(
         substring(content_url from '^https://(?:www\.|m\.)?youtube\.com/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:&|$)'),
         substring(content_url from '^https://youtu\.be/([A-Za-z0-9_-]{11})(?:\?|$)'),
         substring(content_url from '^https://(?:www\.)?youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{11})(?:\?|$)')
       )
 WHERE content_url IS NOT NULL
   AND position('list=' in content_url) = 0;

-- A video row whose reference could not be decoded must not stay published
-- with a broken player. Unpublishing is reversible; the material and its
-- URL are preserved for the administrator to correct.
UPDATE lesson_materials
   SET is_published = false
 WHERE material_type = 'video' AND video_id IS NULL AND is_published;

-- Forward fix for a latent defect in 006, in the same spirit as 013.
--
-- 006 wrote the video branch as `external_url ~ '^https://(www\\.)?...'`.
-- With standard_conforming_strings on, the doubled backslash is a literal
-- backslash in the pattern, so the constraint actually demanded a URL like
-- `https://youtube\.com/...`. No genuine YouTube URL could ever satisfy it,
-- which is why lesson video has only ever worked through `lessons.content_url`.
-- Verified empirically against a clean PostgreSQL 16 before this was written.
--
-- The replacement anchors on the verified id instead of re-deriving trust
-- from the URL: the application writes `video_id` through the normalizer and
-- regenerates `external_url` from it, so the two can never disagree.
DO $$
DECLARE
  undecodable bigint;
BEGIN
  SELECT count(*) INTO undecodable
    FROM lesson_materials
   WHERE material_type = 'video' AND video_id IS NULL;
  IF undecodable > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten lesson_materials_payload_shape: % video material(s) hold a reference this migration could not decode. Re-enter them through the admin API first.',
      undecodable;
  END IF;
END $$;

ALTER TABLE lesson_materials
  DROP CONSTRAINT lesson_materials_payload_shape,
  ADD CONSTRAINT lesson_materials_payload_shape CHECK (
    (material_type = 'rich_text' AND body_markdown IS NOT NULL AND external_url IS NULL AND storage_key IS NULL AND mime_type IS NULL AND byte_size IS NULL AND video_id IS NULL)
    OR (material_type = 'video' AND body_markdown IS NULL AND video_id IS NOT NULL AND external_url = 'https://www.youtube.com/watch?v=' || video_id AND storage_key IS NULL AND mime_type IS NULL AND byte_size IS NULL)
    OR (material_type = 'document' AND body_markdown IS NULL AND external_url IS NULL AND video_id IS NULL AND storage_key IS NOT NULL AND mime_type = 'application/pdf' AND byte_size BETWEEN 1 AND 209715200)
    OR (material_type = 'image' AND body_markdown IS NULL AND external_url IS NULL AND video_id IS NULL AND storage_key IS NOT NULL AND mime_type ~ '^image/' AND byte_size BETWEEN 1 AND 31457280)
  );

CREATE INDEX lesson_materials_video_published
  ON lesson_materials (lesson_id, position)
  WHERE material_type = 'video' AND is_published AND video_id IS NOT NULL;

-- Server-side record of meaningful playback events.
--
-- This table is analytics and audit only. It deliberately holds no grading
-- authority: `awardLessonXp` and lesson completion never read from it, so a
-- forged `ended` event cannot buy XP, stars or a completed lesson. Position
-- is coarse (whole seconds) and no IP, user agent or device fingerprint is
-- stored — the student id already identifies the row's owner.
CREATE TABLE lesson_video_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id bigint NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  material_id bigint REFERENCES lesson_materials(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  event text NOT NULL,
  position_seconds integer NOT NULL DEFAULT 0,
  occurred_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Bishkek')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_video_events_video_id_shape CHECK (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  CONSTRAINT lesson_video_events_event CHECK (event IN ('started', 'progress', 'ended')),
  CONSTRAINT lesson_video_events_position CHECK (position_seconds BETWEEN 0 AND 86400)
);

-- Idempotency key: replaying the same event for the same video on the same
-- Bishkek day updates the row instead of inserting a duplicate, so a flaky
-- network or a re-mounted player cannot inflate the record.
CREATE UNIQUE INDEX lesson_video_events_daily_unique
  ON lesson_video_events (student_id, lesson_id, video_id, event, occurred_on);

CREATE INDEX lesson_video_events_lesson_recent
  ON lesson_video_events (lesson_id, created_at DESC);

CREATE TRIGGER lesson_video_events_touch_updated_at
BEFORE UPDATE ON lesson_video_events
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();
