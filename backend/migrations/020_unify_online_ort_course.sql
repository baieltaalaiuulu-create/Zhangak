-- The online product is one ORT preparation course. Mathematics and Kyrgyz
-- are lesson-level subjects inside that course, not separate enrolments.
--
-- The pre-production import originally created two subject courses. This
-- migration consolidates those known demo codes without resetting lesson,
-- material, assessment, progress, XP, or enrolment identifiers. Fresh
-- databases without the imported demo slice are intentionally unchanged.

ALTER TABLE course_unit_lessons
  DROP CONSTRAINT course_unit_lessons_lesson_id_course_id_fkey,
  DROP CONSTRAINT course_unit_lessons_unit_id_course_id_fkey;

ALTER TABLE practice_tests
  DROP CONSTRAINT practice_tests_lesson_id_course_id_fkey;

ALTER TABLE practice_attempts
  DROP CONSTRAINT practice_attempts_lesson_id_course_id_fkey;

DO $$
DECLARE
  source_course_id bigint;
  target_course_id bigint;
  lesson_offset integer;
  unit_offset integer;
BEGIN
  SELECT id INTO source_course_id
    FROM courses
   WHERE code = 'demo-ort-kyr'
   FOR UPDATE;

  SELECT id INTO target_course_id
    FROM courses
   WHERE code IN ('demo-ort-2026', 'demo-ort-math')
   ORDER BY CASE code WHEN 'demo-ort-2026' THEN 0 ELSE 1 END
   LIMIT 1
   FOR UPDATE;

  IF source_course_id IS NULL OR target_course_id IS NULL OR source_course_id = target_course_id THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM course_enrollments source_enrolment
      JOIN course_enrollments target_enrolment
        ON target_enrolment.student_id = source_enrolment.student_id
       AND target_enrolment.course_id = target_course_id
     WHERE source_enrolment.course_id = source_course_id
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate ORT courses: a learner has enrolments in both source courses';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM daily_challenges source_challenge
      JOIN daily_challenges target_challenge
        ON target_challenge.course_id = target_course_id
       AND target_challenge.challenge_date = source_challenge.challenge_date
     WHERE source_challenge.course_id = source_course_id
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate ORT courses: daily challenge dates overlap';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM groups source_group
      JOIN groups target_group
        ON target_group.course_id = target_course_id
       AND target_group.is_active = true
       AND lower(btrim(target_group.name)) = lower(btrim(source_group.name))
     WHERE source_group.course_id = source_course_id
       AND source_group.is_active = true
  ) THEN
    RAISE EXCEPTION 'Cannot consolidate ORT courses: active group names overlap';
  END IF;

  SELECT coalesce(max(lesson_number), 0) INTO lesson_offset
    FROM lessons
   WHERE course_id = target_course_id;

  WITH ordered_source AS (
    SELECT id, row_number() OVER (ORDER BY lesson_number, id)::integer AS next_number
      FROM lessons
     WHERE course_id = source_course_id
  )
  UPDATE lessons lesson
     SET lesson_number = lesson_offset + ordered_source.next_number
    FROM ordered_source
   WHERE lesson.id = ordered_source.id;

  SELECT coalesce(max(unit_number), 0) INTO unit_offset
    FROM course_units
   WHERE course_id = target_course_id;

  WITH ordered_source AS (
    SELECT id, row_number() OVER (ORDER BY unit_number, id)::integer AS next_number
      FROM course_units
     WHERE course_id = source_course_id
  )
  UPDATE course_units unit
     SET unit_number = unit_offset + ordered_source.next_number
    FROM ordered_source
   WHERE unit.id = ordered_source.id;

  UPDATE course_unit_lessons SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE course_units SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE lessons SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE practice_tests SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE practice_attempts SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE course_enrollments SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE groups SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE daily_challenges SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE public_applications SET course_id = target_course_id WHERE course_id = source_course_id;
  UPDATE student_xp_awards SET course_id = target_course_id WHERE course_id = source_course_id;

  UPDATE courses
     SET name = 'Подготовка к ОРТ',
         code = 'demo-ort-2026',
         subject = 'ort',
         description = 'Единый онлайн-курс подготовки к ОРТ: математика и кыргызский язык.',
         delivery_mode = 'online',
         is_active = true
   WHERE id = target_course_id;

  UPDATE courses
     SET name = 'Архив: прежний курс кыргызского языка',
         code = 'demo-ort-kyr-archived',
         subject = 'kyr',
         is_active = false
   WHERE id = source_course_id;

  INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
  VALUES (
    NULL,
    'unify_online_ort_course',
    'course',
    target_course_id::text,
    jsonb_build_object('sourceCourseId', source_course_id, 'subjects', jsonb_build_array('math', 'kyr'))
  );
END;
$$;

ALTER TABLE course_unit_lessons
  ADD CONSTRAINT course_unit_lessons_lesson_id_course_id_fkey
    FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id) ON DELETE RESTRICT,
  ADD CONSTRAINT course_unit_lessons_unit_id_course_id_fkey
    FOREIGN KEY (unit_id, course_id) REFERENCES course_units(id, course_id) ON DELETE RESTRICT;

ALTER TABLE practice_tests
  ADD CONSTRAINT practice_tests_lesson_id_course_id_fkey
    FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id) ON DELETE RESTRICT;

ALTER TABLE practice_attempts
  ADD CONSTRAINT practice_attempts_lesson_id_course_id_fkey
    FOREIGN KEY (lesson_id, course_id) REFERENCES lessons(id, course_id) ON DELETE RESTRICT;
