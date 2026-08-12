'use client'

import { authenticatedFetch } from '@/lib/authenticated-fetch'
import type { OfflineStudentDashboard } from '@/lib/offline-student-contract'

export class OfflineStudentRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

export async function fetchOfflineStudentDashboard(): Promise<OfflineStudentDashboard> {
  const response = await authenticatedFetch('/api/offline-student', {
    headers: { Accept: 'application/json' },
  })
  const body = await response.json().catch(() => null) as { error?: unknown } | OfflineStudentDashboard | null

  if (!response.ok) {
    const message = body && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Не удалось загрузить офлайн-кабинет'
    throw new OfflineStudentRequestError(response.status, message)
  }
  if (!body || !('profile' in body) || !Array.isArray(body.lessons) || !Array.isArray(body.homework) || !Array.isArray(body.grades)) {
    throw new OfflineStudentRequestError(503, 'Сервис вернул некорректные данные')
  }
  return body as OfflineStudentDashboard
}
