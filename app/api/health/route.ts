import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SHA_PATTERN = /^[0-9a-f]{7,64}$/i

function normalizeSha(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const sha = value.trim().toLowerCase()
  return SHA_PATTERN.test(sha) ? sha : null
}

async function getReleaseSha(): Promise<string> {
  const environmentSha = normalizeSha(process.env.ZHANGAK_RELEASE_SHA)
  if (environmentSha) return environmentSha

  try {
    const manifestPath = path.join(process.cwd(), 'release.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      gitSha?: unknown
    }

    return normalizeSha(manifest.gitSha) ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      releaseSha: await getReleaseSha(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}
