'use client'

import ApplicationQueueWorkspace from '@/components/applications/ApplicationQueueWorkspace'

export const dynamic = 'force-dynamic'

export default function ManagerPage() {
  return <ApplicationQueueWorkspace title="Заявки на обучение" managerMode />
}
