import { requireAuth } from '../auth.js'
import { transaction } from '../db.js'
import { GET, HttpError, PATCH, readJson } from '../http.js'

// Profile endpoints deliberately have a narrower role boundary than the
// generic auth endpoint. A teacher or administrator must use their own
// workspace routes rather than mutating a student profile through this API.
const STUDENT_ROLES = new Set(['student', 'math_student'])
const MIN_TARGET_SCORE = 100
const MAX_TARGET_SCORE = 245
const MAX_AVATAR_URL_LENGTH = 2_048
const PROFILE_COLORS = new Set(['blue', 'violet', 'emerald', 'rose'])
const DAILY_STUDY_GOAL_MINUTES = new Set([15, 30, 45, 60, 90])

function publicProfile(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    studentType: user.student_type,
    phone: user.phone,
    targetScore: user.target_score,
    avatarUrl: user.avatar_url,
    profileColor: user.profile_color,
    dailyStudyGoalMinutes: user.daily_study_goal_minutes,
  }
}

async function currentStudent(config, req) {
  const user = await requireAuth(config, req)
  if (!STUDENT_ROLES.has(user.role)) {
    throw new HttpError(403, 'Доступен только ученику', 'student_required')
  }
  return user
}

function normalizedName(value) {
  if (typeof value !== 'string') return null
  const name = value.trim()
  return name.length >= 1 && name.length <= 200 ? name : null
}

export function normalizeAvatarUrl(value) {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const raw = value.trim()
  if (!raw || raw.length > MAX_AVATAR_URL_LENGTH) return undefined
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

/**
 * Accept only fields that a student is allowed to edit about themselves.
 * Keeping this parser explicit prevents accidentally making account role,
 * learning type, phone, or session-related attributes writable as the
 * profile evolves.
 */
export function parseProfilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Некорректные данные профиля', 'invalid_profile_patch')
  }
  const keys = Object.keys(body)
  const allowed = new Set(['fullName', 'avatarUrl', 'targetScore', 'profileColor', 'dailyStudyGoalMinutes'])
  if (keys.length === 0 || keys.some(key => !allowed.has(key))) {
    throw new HttpError(400, 'Некорректные данные профиля', 'invalid_profile_patch')
  }

  const patch = {
    hasFullName: Object.hasOwn(body, 'fullName'),
    fullName: null,
    hasAvatarUrl: Object.hasOwn(body, 'avatarUrl'),
    avatarUrl: null,
    hasTargetScore: Object.hasOwn(body, 'targetScore'),
    targetScore: null,
    hasProfileColor: Object.hasOwn(body, 'profileColor'),
    profileColor: null,
    hasDailyStudyGoalMinutes: Object.hasOwn(body, 'dailyStudyGoalMinutes'),
    dailyStudyGoalMinutes: null,
  }

  if (patch.hasFullName) {
    patch.fullName = normalizedName(body.fullName)
    if (!patch.fullName) throw new HttpError(400, 'Некорректное имя', 'invalid_full_name')
  }
  if (patch.hasAvatarUrl) {
    patch.avatarUrl = normalizeAvatarUrl(body.avatarUrl)
    if (patch.avatarUrl === undefined) throw new HttpError(400, 'Некорректная ссылка на фото', 'invalid_avatar_url')
  }
  if (patch.hasTargetScore) {
    if (!Number.isSafeInteger(body.targetScore)
      || body.targetScore < MIN_TARGET_SCORE
      || body.targetScore > MAX_TARGET_SCORE) {
      throw new HttpError(400, 'Некорректная цель по ОРТ', 'invalid_target_score')
    }
    patch.targetScore = body.targetScore
  }
  if (patch.hasProfileColor) {
    if (typeof body.profileColor !== 'string' || !PROFILE_COLORS.has(body.profileColor)) {
      throw new HttpError(400, 'Некорректный цвет профиля', 'invalid_profile_color')
    }
    patch.profileColor = body.profileColor
  }
  if (patch.hasDailyStudyGoalMinutes) {
    if (!Number.isSafeInteger(body.dailyStudyGoalMinutes)
      || !DAILY_STUDY_GOAL_MINUTES.has(body.dailyStudyGoalMinutes)) {
      throw new HttpError(400, 'Некорректная ежедневная цель', 'invalid_daily_study_goal')
    }
    patch.dailyStudyGoalMinutes = body.dailyStudyGoalMinutes
  }
  return patch
}

GET('/v1/platform/profile', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  return { status: 200, body: { profile: publicProfile(student) } }
})

PATCH('/v1/platform/profile', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const patch = parseProfilePatch(await readJson(req, 8_000))
  const changedFields = [
    patch.hasFullName && 'fullName',
    patch.hasAvatarUrl && 'avatarUrl',
    patch.hasTargetScore && 'targetScore',
    patch.hasProfileColor && 'profileColor',
    patch.hasDailyStudyGoalMinutes && 'dailyStudyGoalMinutes',
  ].filter(Boolean)

  const profile = await transaction(async client => {
    const updated = await client.query(
      `UPDATE profiles
          SET full_name = CASE WHEN $2::boolean THEN $3::text ELSE full_name END,
              avatar_url = CASE WHEN $4::boolean THEN $5::text ELSE avatar_url END,
              target_score = CASE WHEN $6::boolean THEN $7::integer ELSE target_score END,
              profile_color = CASE WHEN $8::boolean THEN $9::text ELSE profile_color END,
              daily_study_goal_minutes = CASE WHEN $10::boolean THEN $11::smallint ELSE daily_study_goal_minutes END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING full_name, role, student_type, phone, target_score, avatar_url,
                  profile_color, daily_study_goal_minutes`,
      [
        student.id,
        patch.hasFullName,
        patch.fullName,
        patch.hasAvatarUrl,
        patch.avatarUrl,
        patch.hasTargetScore,
        patch.targetScore,
        patch.hasProfileColor,
        patch.profileColor,
        patch.hasDailyStudyGoalMinutes,
        patch.dailyStudyGoalMinutes,
      ],
    )
    const row = updated.rows[0]
    if (!row) throw new HttpError(404, 'Профиль не найден', 'profile_not_found')
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_own_profile', 'profile', $2, $3::jsonb)`,
      [student.id, student.id, JSON.stringify({ fields: changedFields })],
    )
    return row
  })

  return {
    status: 200,
    body: {
      profile: publicProfile({ ...student, ...profile }),
    },
  }
})
