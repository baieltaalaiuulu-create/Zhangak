-- Student-controlled presentation and study preferences.  Both columns are
-- closed enums/ranges rather than arbitrary client values so they remain safe
-- to consume in user interfaces and reports.

ALTER TABLE profiles
  ADD COLUMN profile_color text NOT NULL DEFAULT 'blue',
  ADD COLUMN daily_study_goal_minutes smallint NOT NULL DEFAULT 30,
  ADD CONSTRAINT profiles_profile_color CHECK (profile_color IN ('blue', 'violet', 'emerald', 'rose')),
  ADD CONSTRAINT profiles_daily_study_goal_minutes CHECK (daily_study_goal_minutes IN (15, 30, 45, 60, 90));
