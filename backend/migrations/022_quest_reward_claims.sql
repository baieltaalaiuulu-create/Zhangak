-- Quest progress becomes claimable before XP is awarded.  This gives the
-- learner an explicit reward interaction while preserving the existing
-- idempotent XP ledger as the only source of points.

ALTER TABLE student_quest_progress
  ADD COLUMN ready_at timestamptz;

UPDATE student_quest_progress
   SET ready_at = completed_at
 WHERE completed_at IS NOT NULL;

ALTER TABLE student_quest_progress
  ADD CONSTRAINT student_quest_progress_ready_state CHECK (
    completed_at IS NULL OR ready_at IS NOT NULL
  );

CREATE INDEX student_quest_progress_claimable
  ON student_quest_progress (student_id, ready_at DESC)
  WHERE ready_at IS NOT NULL AND completed_at IS NULL;
