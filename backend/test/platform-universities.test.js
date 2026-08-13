import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { publicUniversity } from '../src/routes/platform-universities.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const UNIVERSITY_ID = '7d794428-2199-46e5-9149-10b55188bd5b'

test('student university projection uses only safe, active-catalog fields', () => {
  const university = publicUniversity({
    id: UNIVERSITY_ID,
    name: 'Тестовый университет',
    city: 'Бишкек',
    type: 'government',
    description: 'Проверенное описание.',
    logo_url: 'javascript:alert(1)',
    website_url: 'https://example.edu/admission',
    min_score: 145,
    avg_score: 165,
    tuition_min: 45000,
    tuition_max: 70000,
    dormitory: true,
    budget_places: true,
    rating: '4.75',
    languages: ['Русский', 'kg', 'Неподдерживаемый'],
    is_active: true,
    internal_note: 'must never be exposed',
    specialties: [{
      id: 'f54a10db-fc60-4f33-b904-a1e44fe8b179',
      name: 'Программная инженерия',
      faculty: 'ИТ',
      min_score: 160,
      tuition: 50000,
      language: 'Русский',
      form: 'Очная',
      type: 'Контракт',
      is_active: true,
      internal_note: 'must never be exposed',
    }],
    advantages: [{
      id: '552cb8ff-48e7-4ebc-b3d8-7db3d839323f',
      icon: 'international',
      title: 'Международные программы',
      description: 'Обмен и языковые программы.',
      created_at: '2026-01-01T00:00:00.000Z',
      internal_note: 'must never be exposed',
    }],
  })

  assert.deepEqual(university, {
    id: UNIVERSITY_ID,
    name: 'Тестовый университет',
    shortName: 'Тестовый университет',
    logoUrl: null,
    city: 'Бишкек',
    type: 'state',
    minScore: 145,
    avgScore: 165,
    costFrom: 45000,
    costMax: 70000,
    specialtyCount: 1,
    rating: 4.75,
    description: 'Проверенное описание.',
    about: ['Проверенное описание.'],
    advantages: [{
      iconKey: 'international',
      title: 'Международные программы',
      description: 'Обмен и языковые программы.',
    }],
    hasDormitory: true,
    budgetSeats: true,
    directions: ['it'],
    languages: ['ru', 'kg'],
    website: 'https://example.edu/admission',
    specialties: [{
      id: 'f54a10db-fc60-4f33-b904-a1e44fe8b179',
      name: 'Программная инженерия',
      faculty: 'ИТ',
      minScore: 160,
      costPerYear: 50000,
      language: 'Русский',
      form: 'Очная',
      type: 'Контракт',
    }],
  })
  assert.equal(Object.hasOwn(university, 'isActive'), false)
  assert.equal(Object.hasOwn(university, 'internalNote'), false)
  assert.equal(Object.hasOwn(university.specialties[0], 'internalNote'), false)
})

test('university migration creates an empty curated catalog with active-row indexes', async () => {
  const migration = await readFile(path.join(backendRoot, 'migrations', '003_university_catalog.sql'), 'utf8')
  for (const table of ['universities', 'university_specialties', 'university_advantages']) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table} \\(`))
  }
  assert.match(migration, /CREATE INDEX universities_active_catalog_order/)
  assert.match(migration, /CREATE INDEX university_specialties_active_catalog/)
  assert.match(migration, /FOREIGN KEY|REFERENCES universities\(id\) ON DELETE CASCADE/)
  assert.doesNotMatch(migration, /INSERT INTO universities/i)
})

test('student catalog route is authenticated, active-only, and has no write handler', async () => {
  const source = await readFile(path.join(backendRoot, 'src', 'routes', 'platform-universities.js'), 'utf8')
  assert.match(source, /requireAuth\(config, req\)/)
  assert.match(source, /STUDENT_ROLES/)
  assert.match(source, /WHERE u\.is_active = true/)
  assert.match(source, /AND s\.is_active = true/)
  assert.match(source, /GET\('\/v1\/platform\/universities'/)
  assert.match(source, /GET\('\/v1\/platform\/universities\/:id'/)
  assert.doesNotMatch(source, /(?:POST|PATCH|DELETE)\('\/v1\/platform\/universities/)
})
