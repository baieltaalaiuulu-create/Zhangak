-- A submitted lesson test advances the ordered learning path, while its
-- actual percentage remains the student's best earned result for roadmap
-- rings and 50/75/90 stars.  The original v1 constraint only permitted a
-- completed row at 100%, which made every submitted test look perfect.

ALTER TABLE lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_completed;

ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_completed
  CHECK (completed_at IS NULL OR completion_percent BETWEEN 0 AND 100);
