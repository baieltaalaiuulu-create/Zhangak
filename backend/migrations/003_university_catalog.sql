-- First-party university catalog. Content is deliberately empty on creation:
-- verified universities and specialties are imported or curated later through
-- a privileged back-office flow. Student routes project only active rows.

CREATE TABLE universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  type text NOT NULL,
  description text,
  logo_url text,
  website_url text,
  min_score smallint,
  avg_score smallint,
  tuition_min integer,
  tuition_max integer,
  dormitory boolean NOT NULL DEFAULT false,
  budget_places boolean NOT NULL DEFAULT false,
  rating numeric(3,2),
  languages text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT universities_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 300),
  CONSTRAINT universities_city_length CHECK (char_length(btrim(city)) BETWEEN 1 AND 120),
  CONSTRAINT universities_type CHECK (type IN ('government', 'private')),
  CONSTRAINT universities_description_length CHECK (description IS NULL OR char_length(description) <= 20_000),
  CONSTRAINT universities_logo_url_length CHECK (logo_url IS NULL OR char_length(logo_url) <= 2_048),
  CONSTRAINT universities_website_url_length CHECK (website_url IS NULL OR char_length(website_url) <= 2_048),
  CONSTRAINT universities_min_score CHECK (min_score IS NULL OR min_score BETWEEN 0 AND 245),
  CONSTRAINT universities_avg_score CHECK (avg_score IS NULL OR avg_score BETWEEN 0 AND 245),
  CONSTRAINT universities_tuition_min CHECK (tuition_min IS NULL OR tuition_min >= 0),
  CONSTRAINT universities_tuition_max CHECK (tuition_max IS NULL OR tuition_max >= 0),
  CONSTRAINT universities_tuition_range CHECK (
    tuition_min IS NULL OR tuition_max IS NULL OR tuition_max >= tuition_min
  ),
  CONSTRAINT universities_rating CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  CONSTRAINT universities_language_count CHECK (cardinality(languages) <= 12)
);

CREATE INDEX universities_active_catalog_order
  ON universities (rating DESC NULLS LAST, name, id)
  WHERE is_active;

CREATE TABLE university_specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name text NOT NULL,
  faculty text,
  min_score smallint,
  tuition integer,
  language text,
  form text,
  type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT university_specialties_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 300),
  CONSTRAINT university_specialties_faculty_length CHECK (faculty IS NULL OR char_length(faculty) <= 300),
  CONSTRAINT university_specialties_min_score CHECK (min_score IS NULL OR min_score BETWEEN 0 AND 245),
  CONSTRAINT university_specialties_tuition CHECK (tuition IS NULL OR tuition >= 0),
  CONSTRAINT university_specialties_language_length CHECK (language IS NULL OR char_length(btrim(language)) BETWEEN 1 AND 80),
  CONSTRAINT university_specialties_form_length CHECK (form IS NULL OR char_length(btrim(form)) BETWEEN 1 AND 80),
  CONSTRAINT university_specialties_type_length CHECK (type IS NULL OR char_length(btrim(type)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX university_specialties_active_name_unique
  ON university_specialties (university_id, lower(btrim(name)), lower(btrim(coalesce(faculty, ''))))
  WHERE is_active;
CREATE INDEX university_specialties_active_catalog
  ON university_specialties (university_id, name, id)
  WHERE is_active;

CREATE TABLE university_advantages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  icon text,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT university_advantages_icon_length CHECK (icon IS NULL OR char_length(icon) <= 80),
  CONSTRAINT university_advantages_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT university_advantages_description_length CHECK (description IS NULL OR char_length(description) <= 2_000)
);

CREATE INDEX university_advantages_catalog
  ON university_advantages (university_id, created_at, id);

CREATE TRIGGER universities_touch_updated_at
BEFORE UPDATE ON universities
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER university_specialties_touch_updated_at
BEFORE UPDATE ON university_specialties
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();

CREATE TRIGGER university_advantages_touch_updated_at
BEFORE UPDATE ON university_advantages
FOR EACH ROW EXECUTE FUNCTION learning_touch_updated_at();
