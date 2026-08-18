-- PostgreSQL rejects regex repetition counts above 255 while evaluating a
-- constraint. Keep the same 512-character contract with an explicit length
-- check and an unbounded, character-safe expression.

ALTER TABLE lesson_materials
  DROP CONSTRAINT lesson_materials_private_key,
  ADD CONSTRAINT lesson_materials_private_key CHECK (
    storage_key IS NULL OR (
      char_length(storage_key) BETWEEN 1 AND 512
      AND storage_key ~ '^[a-z0-9][a-z0-9/_-]*$'
    )
  );
