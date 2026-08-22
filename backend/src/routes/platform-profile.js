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
const COMMUNITY_VISIBILITY = new Set(['private', 'community', 'leaderboard'])
const COSMETIC_CODE = /^[a-z][a-z0-9_]{2,63}$/

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
    communityVisibility: user.community_visibility,
    publicProfileId: user.public_profile_id,
    communityDisplayName: user.community_display_name,
    communityProfileVisibility: user.community_profile_visibility,
    communityShowXp: user.community_show_xp,
    communityShowAchievements: user.community_show_achievements,
    communityShowStreak: user.community_show_streak,
    communityAllowFriendRequests: user.community_allow_friend_requests,
    communityDiscoverable: user.community_discoverable,
    profileFrameCode: user.profile_frame_code,
    profileBackgroundCode: user.profile_background_code,
    profileTitleCode: user.profile_title_code,
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

function exactObject(body, allowed, code) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Некорректные данные профиля сообщества', code)
  }
  const keys = Object.keys(body)
  if (keys.length === 0 || keys.some(key => !allowed.has(key))) {
    throw new HttpError(400, 'Некорректные данные профиля сообщества', code)
  }
}

function communityDisplayName(value) {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length < 2 || normalized.length > 24 || /[\u0000-\u001F\u007F]/.test(normalized)) return undefined
  return normalized
}

export function parseCommunitySettingsPatch(body) {
  const allowed = new Set(['displayName', 'visibility', 'showXp', 'showAchievements', 'showStreak', 'allowFriendRequests', 'discoverable'])
  exactObject(body, allowed, 'invalid_community_settings')
  const patch = {}
  if (Object.hasOwn(body, 'displayName')) {
    patch.displayName = communityDisplayName(body.displayName)
    if (patch.displayName === undefined) throw new HttpError(400, 'Некорректный псевдоним', 'invalid_community_display_name')
  }
  if (Object.hasOwn(body, 'visibility')) {
    if (typeof body.visibility !== 'string' || !COMMUNITY_VISIBILITY.has(body.visibility)) throw new HttpError(400, 'Некорректная видимость профиля', 'invalid_community_visibility')
    patch.visibility = body.visibility
  }
  for (const [field, key] of [
    ['showXp', 'showXp'], ['showAchievements', 'showAchievements'], ['showStreak', 'showStreak'],
    ['allowFriendRequests', 'allowFriendRequests'], ['discoverable', 'discoverable'],
  ]) {
    if (Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'boolean') throw new HttpError(400, 'Некорректная настройка сообщества', 'invalid_community_settings')
      patch[key] = body[field]
    }
  }
  return patch
}

export function parseProfileLoadout(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).sort().join(',') !== 'backgroundCode,frameCode,titleCode') {
    throw new HttpError(400, 'Некорректное оформление профиля', 'invalid_profile_loadout')
  }
  const values = {
    frameCode: body.frameCode,
    backgroundCode: body.backgroundCode,
    titleCode: body.titleCode,
  }
  if (Object.values(values).some(value => typeof value !== 'string' || !COSMETIC_CODE.test(value))) {
    throw new HttpError(400, 'Некорректное оформление профиля', 'invalid_profile_loadout')
  }
  return values
}

export function parseFeaturedAchievements(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !Array.isArray(body.achievementIds)) {
    throw new HttpError(400, 'Некорректная витрина достижений', 'invalid_featured_achievements')
  }
  if (body.achievementIds.length > 3 || body.achievementIds.some(id => !Number.isSafeInteger(id) || id < 1)
    || new Set(body.achievementIds).size !== body.achievementIds.length) {
    throw new HttpError(400, 'Некорректная витрина достижений', 'invalid_featured_achievements')
  }
  return body.achievementIds
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
  const allowed = new Set(['fullName', 'avatarUrl', 'targetScore', 'profileColor', 'dailyStudyGoalMinutes', 'communityVisibility'])
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
    hasCommunityVisibility: Object.hasOwn(body, 'communityVisibility'),
    communityVisibility: null,
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
  if (patch.hasCommunityVisibility) {
    if (typeof body.communityVisibility !== 'boolean') throw new HttpError(400, 'Некорректная настройка сообщества', 'invalid_community_visibility')
    patch.communityVisibility = body.communityVisibility
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
    patch.hasCommunityVisibility && 'communityVisibility',
  ].filter(Boolean)

  const profile = await transaction(async client => {
    const updated = await client.query(
      `UPDATE profiles
          SET full_name = CASE WHEN $2::boolean THEN $3::text ELSE full_name END,
              avatar_url = CASE WHEN $4::boolean THEN $5::text ELSE avatar_url END,
              target_score = CASE WHEN $6::boolean THEN $7::integer ELSE target_score END,
              profile_color = CASE WHEN $8::boolean THEN $9::text ELSE profile_color END,
              daily_study_goal_minutes = CASE WHEN $10::boolean THEN $11::smallint ELSE daily_study_goal_minutes END,
              community_visibility = CASE WHEN $12::boolean THEN $13::boolean ELSE community_visibility END,
              community_profile_visibility = CASE WHEN $12::boolean THEN CASE WHEN $13::boolean THEN 'leaderboard' ELSE 'private' END ELSE community_profile_visibility END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING full_name, role, student_type, phone, target_score, avatar_url,
                  profile_color, daily_study_goal_minutes, community_visibility`,
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
        patch.hasCommunityVisibility,
        patch.communityVisibility,
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

GET('/v1/platform/profile/customization', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const [cosmetics, achievements, featured] = await Promise.all([
    query(
      `SELECT d.code, d.category, d.title, d.description, d.rarity
         FROM student_profile_cosmetics owned
         JOIN profile_cosmetic_definitions d ON d.id = owned.cosmetic_id AND d.is_active = true
        WHERE owned.student_id = $1
        ORDER BY d.category, d.sort_order, d.code`,
      [student.id],
    ),
    query(
      `SELECT d.id, d.code, d.title, d.description, d.icon_key, a.unlocked_at
         FROM student_achievements a
         JOIN achievement_definitions d ON d.id = a.achievement_id AND d.is_active = true
        WHERE a.student_id = $1
        ORDER BY a.unlocked_at DESC, d.sort_order, d.code`,
      [student.id],
    ),
    query(
      `SELECT f.slot, d.id, d.code
         FROM student_featured_achievements f
         JOIN achievement_definitions d ON d.id = f.achievement_id
        WHERE f.student_id = $1 ORDER BY f.slot`,
      [student.id],
    ),
  ])
  return {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
    body: {
      community: {
        publicProfileId: student.public_profile_id,
        displayName: student.community_display_name,
        visibility: student.community_profile_visibility,
        showXp: student.community_show_xp,
        showAchievements: student.community_show_achievements,
        showStreak: student.community_show_streak,
        allowFriendRequests: student.community_allow_friend_requests,
        discoverable: student.community_discoverable,
      },
      loadout: {
        frameCode: student.profile_frame_code,
        backgroundCode: student.profile_background_code,
        titleCode: student.profile_title_code,
      },
      cosmetics: cosmetics.rows.map(row => ({ code: row.code, category: row.category, title: row.title, description: row.description, rarity: row.rarity })),
      achievements: achievements.rows.map(row => ({ id: Number(row.id), code: row.code, title: row.title, description: row.description, iconKey: row.icon_key, unlockedAt: row.unlocked_at })),
      featuredAchievementIds: featured.rows.map(row => Number(row.id)),
    },
  }
})

PATCH('/v1/platform/profile/community', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const patch = parseCommunitySettingsPatch(await readJson(req, 4_000))
  const changed = Object.keys(patch)
  const updated = await transaction(async client => {
    const result = await client.query(
      `UPDATE profiles
          SET community_display_name = CASE WHEN $2::boolean THEN $3::text ELSE community_display_name END,
              community_profile_visibility = CASE WHEN $4::boolean THEN $5::text ELSE community_profile_visibility END,
              community_visibility = CASE WHEN $4::boolean THEN ($5::text = 'leaderboard') ELSE community_visibility END,
              community_show_xp = CASE WHEN $6::boolean THEN $7::boolean ELSE community_show_xp END,
              community_show_achievements = CASE WHEN $8::boolean THEN $9::boolean ELSE community_show_achievements END,
              community_show_streak = CASE WHEN $10::boolean THEN $11::boolean ELSE community_show_streak END,
              community_allow_friend_requests = CASE WHEN $12::boolean THEN $13::boolean ELSE community_allow_friend_requests END,
              community_discoverable = CASE WHEN $14::boolean THEN $15::boolean ELSE community_discoverable END,
              updated_at = now()
        WHERE user_id = $1
        RETURNING public_profile_id, community_display_name, community_profile_visibility,
                  community_show_xp, community_show_achievements, community_show_streak,
                  community_allow_friend_requests, community_discoverable`,
      [student.id,
        Object.hasOwn(patch, 'displayName'), patch.displayName ?? null,
        Object.hasOwn(patch, 'visibility'), patch.visibility ?? null,
        Object.hasOwn(patch, 'showXp'), patch.showXp ?? false,
        Object.hasOwn(patch, 'showAchievements'), patch.showAchievements ?? false,
        Object.hasOwn(patch, 'showStreak'), patch.showStreak ?? false,
        Object.hasOwn(patch, 'allowFriendRequests'), patch.allowFriendRequests ?? false,
        Object.hasOwn(patch, 'discoverable'), patch.discoverable ?? false,
      ],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_community_profile', 'profile', $1, $2::jsonb)`,
      [student.id, JSON.stringify({ fields: changed })],
    )
    return result.rows[0]
  })
  return { status: 200, body: { community: {
    publicProfileId: updated.public_profile_id, displayName: updated.community_display_name,
    visibility: updated.community_profile_visibility, showXp: updated.community_show_xp,
    showAchievements: updated.community_show_achievements, showStreak: updated.community_show_streak,
    allowFriendRequests: updated.community_allow_friend_requests, discoverable: updated.community_discoverable,
  } } }
})

PATCH('/v1/platform/profile/loadout', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const loadout = parseProfileLoadout(await readJson(req, 2_000))
  const result = await transaction(async client => {
    const owned = await client.query(
      `SELECT d.code, d.category
         FROM student_profile_cosmetics owned
         JOIN profile_cosmetic_definitions d ON d.id = owned.cosmetic_id AND d.is_active = true
        WHERE owned.student_id = $1 AND d.code = ANY($2::text[])`,
      [student.id, [loadout.frameCode, loadout.backgroundCode, loadout.titleCode]],
    )
    const categories = new Map(owned.rows.map(row => [row.code, row.category]))
    if (categories.get(loadout.frameCode) !== 'frame' || categories.get(loadout.backgroundCode) !== 'background' || categories.get(loadout.titleCode) !== 'title') {
      throw new HttpError(403, 'Это оформление пока недоступно', 'profile_cosmetic_locked')
    }
    const updated = await client.query(
      `UPDATE profiles
          SET profile_frame_code = $2, profile_background_code = $3, profile_title_code = $4, updated_at = now()
        WHERE user_id = $1
        RETURNING profile_frame_code, profile_background_code, profile_title_code`,
      [student.id, loadout.frameCode, loadout.backgroundCode, loadout.titleCode],
    )
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_profile_loadout', 'profile', $1, $2::jsonb)`,
      [student.id, JSON.stringify(loadout)],
    )
    return updated.rows[0]
  })
  return { status: 200, body: { loadout: { frameCode: result.profile_frame_code, backgroundCode: result.profile_background_code, titleCode: result.profile_title_code } } }
})

PATCH('/v1/platform/profile/featured-achievements', async ({ req, config }) => {
  const student = await currentStudent(config, req)
  const achievementIds = parseFeaturedAchievements(await readJson(req, 2_000))
  await transaction(async client => {
    if (achievementIds.length > 0) {
      const owned = await client.query(
        `SELECT achievement_id FROM student_achievements WHERE student_id = $1 AND achievement_id = ANY($2::bigint[])`,
        [student.id, achievementIds],
      )
      if (owned.rows.length !== achievementIds.length) throw new HttpError(403, 'Можно показать только свои достижения', 'featured_achievement_not_owned')
    }
    await client.query(`DELETE FROM student_featured_achievements WHERE student_id = $1`, [student.id])
    for (const [index, achievementId] of achievementIds.entries()) {
      await client.query(
        `INSERT INTO student_featured_achievements (student_id, achievement_id, slot) VALUES ($1, $2, $3)`,
        [student.id, achievementId, index + 1],
      )
    }
    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, target_type, target_id, metadata)
       VALUES ($1, 'update_featured_achievements', 'profile', $1, $2::jsonb)`,
      [student.id, JSON.stringify({ achievementIds })],
    )
  })
  return { status: 200, body: { featuredAchievementIds: achievementIds } }
})
