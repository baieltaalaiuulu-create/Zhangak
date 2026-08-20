import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeAvatarUrl, parseProfilePatch } from '../src/routes/platform-profile.js'
import { HttpError } from '../src/http.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function invalidPatch(body, code) {
  assert.throws(
    () => parseProfilePatch(body),
    error => error instanceof HttpError && error.status === 400 && error.code === code,
  )
}

test('student profile patch accepts only the six safe, typed profile fields', () => {
  assert.deepEqual(parseProfilePatch({
    fullName: '  Айзада Токтосунова  ',
    avatarUrl: 'https://cdn.zhangak.com/avatars/aizada.png',
    targetScore: 210,
    profileColor: 'violet',
    dailyStudyGoalMinutes: 45,
    communityVisibility: false,
  }), {
    hasFullName: true,
    fullName: 'Айзада Токтосунова',
    hasAvatarUrl: true,
    avatarUrl: 'https://cdn.zhangak.com/avatars/aizada.png',
    hasTargetScore: true,
    targetScore: 210,
    hasProfileColor: true,
    profileColor: 'violet',
    hasDailyStudyGoalMinutes: true,
    dailyStudyGoalMinutes: 45,
    hasCommunityVisibility: true,
    communityVisibility: false,
  })

  assert.deepEqual(parseProfilePatch({ avatarUrl: null }), {
    hasFullName: false,
    fullName: null,
    hasAvatarUrl: true,
    avatarUrl: null,
    hasTargetScore: false,
    targetScore: null,
    hasProfileColor: false,
    profileColor: null,
    hasDailyStudyGoalMinutes: false,
    dailyStudyGoalMinutes: null,
    hasCommunityVisibility: false,
    communityVisibility: null,
  })
})

test('student profile patch fails closed for privilege fields and invalid values', () => {
  invalidPatch({}, 'invalid_profile_patch')
  invalidPatch({ role: 'admin' }, 'invalid_profile_patch')
  invalidPatch({ studentType: 'offline' }, 'invalid_profile_patch')
  invalidPatch({ phone: '+996555000000' }, 'invalid_profile_patch')
  invalidPatch({ fullName: '' }, 'invalid_full_name')
  invalidPatch({ fullName: ' '.repeat(201) }, 'invalid_full_name')
  invalidPatch({ targetScore: 99 }, 'invalid_target_score')
  invalidPatch({ targetScore: 246 }, 'invalid_target_score')
  invalidPatch({ targetScore: 180.5 }, 'invalid_target_score')
  invalidPatch({ avatarUrl: 'http://example.test/avatar.png' }, 'invalid_avatar_url')
  invalidPatch({ avatarUrl: 'javascript:alert(1)' }, 'invalid_avatar_url')
  invalidPatch({ avatarUrl: '' }, 'invalid_avatar_url')
  invalidPatch({ profileColor: 'linear-gradient(red, blue)' }, 'invalid_profile_color')
  invalidPatch({ profileColor: 'blue; background: url(x)' }, 'invalid_profile_color')
  invalidPatch({ dailyStudyGoalMinutes: 20 }, 'invalid_daily_study_goal')
  invalidPatch({ dailyStudyGoalMinutes: 30.5 }, 'invalid_daily_study_goal')
  invalidPatch({ communityVisibility: 'yes' }, 'invalid_community_visibility')
})

test('avatar URL normalization permits only a safe HTTPS external URL or clearing', () => {
  assert.equal(normalizeAvatarUrl(' https://images.example.org/avatar.webp?rev=2 '), 'https://images.example.org/avatar.webp?rev=2')
  assert.equal(normalizeAvatarUrl(null), null)
  assert.equal(normalizeAvatarUrl('data:image/png;base64,abc'), undefined)
  assert.equal(normalizeAvatarUrl('https://user:password@example.org/avatar.png'), undefined)
})

test('profile route is registered, student-scoped, and never exposes a deletion path', async () => {
  const [source, server, migration] = await Promise.all([
    readFile(path.join(backendRoot, 'src', 'routes', 'platform-profile.js'), 'utf8'),
    readFile(path.join(backendRoot, 'src', 'server.js'), 'utf8'),
    readFile(path.join(backendRoot, 'migrations', '004_student_profile_preferences.sql'), 'utf8'),
  ])
  assert.match(server, /import '\.\/routes\/platform-profile\.js'/)
  assert.match(source, /GET\('\/v1\/platform\/profile'/)
  assert.match(source, /PATCH\('\/v1\/platform\/profile'/)
  assert.match(source, /STUDENT_ROLES = new Set\(\['student', 'math_student'\]\)/)
  assert.match(source, /await requireAuth\(config, req\)/)
  assert.match(source, /UPDATE profiles/)
  assert.match(source, /profile_color/)
  assert.match(source, /daily_study_goal_minutes/)
  assert.match(source, /community_visibility/)
  assert.match(migration, /profile_color IN \('blue', 'violet', 'emerald', 'rose'\)/)
  assert.match(migration, /daily_study_goal_minutes IN \(15, 30, 45, 60, 90\)/)
  assert.match(source, /'update_own_profile'/)
  assert.doesNotMatch(source, /DELETE\('\/v1\/platform\/profile'/)
  assert.doesNotMatch(source, /UPDATE users/)
})
