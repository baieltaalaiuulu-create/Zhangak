import { headers } from 'next/headers'

import LoginExperience from '@/components/auth/LoginExperience'
import { siteSurfaceForHost, type SiteSurface } from '@/lib/site-hosts'

export const dynamic = 'force-dynamic'

type LoginSearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  const surfaceFromHost = siteSurfaceForHost((await headers()).get('host'))
  const query = await searchParams
  // Unknown preview/direct hosts can select a visual surface explicitly for
  // QA. The four owned domains always win, so a query parameter can never
  // turn the real platform login into an admin surface or vice versa.
  const previewSurface = !surfaceFromHost && query.surface === 'admin'
    ? 'admin'
    : null
  const surface: Exclude<SiteSurface, 'marketing'> = surfaceFromHost === 'admin' || surfaceFromHost === 'platform' || surfaceFromHost === 'offline'
    ? surfaceFromHost
    : previewSurface ?? 'platform'

  return <LoginExperience surface={surface} />
}
