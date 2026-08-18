import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addAdminGroupStudent,
  createAdminGroup,
  listAdminGroupAssignees,
  listAdminGroupMembers,
  listAdminGroups,
  parseAdminGroupList,
  parseAdminGroupMemberList,
  removeAdminGroupStudent,
  setAdminGroupTeacher,
  updateAdminGroup,
} from '../../lib/admin-groups-client.ts'

const TEACHER_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'

const GROUP = {
  id: 9,
  course: { id: 4, name: 'Подготовка к ОРТ', code: 'ort-11', level: '11 класс', subject: 'Математика' },
  teacher: { id: TEACHER_ID, fullName: 'Айдана Эсенова' },
  name: 'ОРТ-11 / вечер',
  deliveryMode: 'offline',
  capacity: 20,
  startsOn: '2026-09-01',
  endsOn: '2027-05-20',
  isActive: true,
  activeStudentCount: 1,
  createdAt: '2026-08-13T08:00:00.000Z',
  updatedAt: '2026-08-13T08:00:00.000Z',
}

const MEMBER = {
  membershipId: 12,
  id: STUDENT_ID,
  fullName: 'Бекзат Токтогулов',
  email: 'bekzat@example.test',
  studentType: 'offline',
  joinedAt: '2026-08-13T08:00:00.000Z',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function installBrowserWindow(): () => void {
  const existing = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} })
  return () => {
    if (existing) Object.defineProperty(globalThis, 'window', existing)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('group DTO parsers accept a narrow own-backend projection', () => {
  assert.deepEqual(parseAdminGroupList({ items: [GROUP], total: 1, limit: 100, offset: 0 }), {
    items: [GROUP], total: 1, limit: 100, offset: 0,
  })
  assert.deepEqual(parseAdminGroupMemberList({ group: GROUP, items: [MEMBER], total: 1, limit: 100, offset: 0 }), {
    group: GROUP, items: [MEMBER], total: 1, limit: 100, offset: 0,
  })
  assert.throws(
    () => parseAdminGroupList({ items: [{ ...GROUP, teacher: { ...GROUP.teacher, id: 'forged' } }], total: 1, limit: 100, offset: 0 }),
    /id преподавателя группы/,
  )
  assert.throws(
    () => parseAdminGroupMemberList({ group: GROUP, items: [{ ...MEMBER, studentType: 'invalid' }], total: 1, limit: 100, offset: 0 }),
    /тип обучения ученика/,
  )
})

test('group client uses only cookie-authenticated first-party admin endpoints', async () => {
  const restoreWindow = installBrowserWindow()
  const originalFetch = globalThis.fetch
  const calls: { input: string; init?: RequestInit }[] = []
  globalThis.fetch = async (input, init) => {
    const path = String(input)
    calls.push({ input: path, init })
    if (path === '/v1/admin/groups?courseId=4&isActive=true&limit=25') return json({ items: [GROUP], total: 1, limit: 25, offset: 0 })
    if (path === '/v1/admin/groups/9/members?limit=50') return json({ group: GROUP, items: [MEMBER], total: 1, limit: 50, offset: 0 })
    if (path === '/v1/admin/group-assignees?kind=teacher&limit=10') return json({
      items: [{ id: TEACHER_ID, fullName: 'Айдана Эсенова', email: 'aidana@example.test' }], total: 1, limit: 10, offset: 0,
    })
    if (path === '/v1/admin/groups' && init?.method === 'POST') return json({ group: GROUP }, 201)
    if (path === '/v1/admin/groups/9' && init?.method === 'PATCH') return json({ group: GROUP })
    if (path === '/v1/admin/groups/9/teacher' && init?.method === 'PATCH') return json({ group: GROUP })
    if (path === '/v1/admin/groups/9/students' && init?.method === 'POST') return json({ created: true, member: MEMBER }, 201)
    if (path === `/v1/admin/groups/9/students/${STUDENT_ID}` && init?.method === 'DELETE') return json({ success: true, membershipId: 12 })
    throw new Error(`Unexpected request ${path}`)
  }

  try {
    await listAdminGroups({ courseId: 4, isActive: true, limit: 25 })
    await listAdminGroupMembers(9, { limit: 50 })
    await listAdminGroupAssignees('teacher', { limit: 10 })
    await createAdminGroup({ courseId: 4, name: GROUP.name, deliveryMode: 'offline', capacity: 20 })
    await updateAdminGroup(9, { isActive: false })
    await setAdminGroupTeacher(9, TEACHER_ID)
    await addAdminGroupStudent(9, STUDENT_ID)
    await removeAdminGroupStudent(9, STUDENT_ID)

    assert.deepEqual(calls.map(call => call.input), [
      '/v1/admin/groups?courseId=4&isActive=true&limit=25',
      '/v1/admin/groups/9/members?limit=50',
      '/v1/admin/group-assignees?kind=teacher&limit=10',
      '/v1/admin/groups',
      '/v1/admin/groups/9',
      '/v1/admin/groups/9/teacher',
      '/v1/admin/groups/9/students',
      `/v1/admin/groups/9/students/${STUDENT_ID}`,
    ])
    assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['GET', 'GET', 'GET', 'POST', 'PATCH', 'PATCH', 'POST', 'DELETE'])
    assert.ok(calls.every(call => call.init?.credentials === 'include'))
    assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { courseId: 4, name: GROUP.name, deliveryMode: 'offline', capacity: 20 })
    assert.deepEqual(JSON.parse(String(calls[5].init?.body)), { teacherId: TEACHER_ID })
  } finally {
    globalThis.fetch = originalFetch
    restoreWindow()
  }
})
