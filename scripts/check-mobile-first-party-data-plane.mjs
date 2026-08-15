import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const mobileRoot = resolve(root, 'mobile')
const forbidden = /@supabase\/|\bsupabase\b|EXPO_PUBLIC_SUPABASE|react-native-get-random-values/i

async function files(directory) {
  const absolute = resolve(mobileRoot, directory)
  const entries = await readdir(absolute, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const child = resolve(absolute, entry.name)
    if (entry.isDirectory()) return files(relative(mobileRoot, child))
    if (!/\.(?:[cm]?[jt]sx?|json)$/i.test(entry.name)) return []
    return [{ path: relative(mobileRoot, child).replaceAll('\\', '/'), content: await readFile(child, 'utf8') }]
  }))
  return nested.flat()
}

const [runtimeSources, envExample, packageJson, packageLock, authSource, lessonSource, learningCacheSource] = await Promise.all([
  Promise.all(['app', 'components', 'lib'].map(files)).then(groups => groups.flat()),
  readFile(resolve(mobileRoot, '.env.example'), 'utf8'),
  readFile(resolve(mobileRoot, 'package.json'), 'utf8'),
  readFile(resolve(mobileRoot, 'package-lock.json'), 'utf8'),
  readFile(resolve(mobileRoot, 'lib/native-auth.ts'), 'utf8'),
  readFile(resolve(mobileRoot, 'lib/lessons.ts'), 'utf8'),
  readFile(resolve(mobileRoot, 'lib/learning-cache.ts'), 'utf8'),
])

const offenders = runtimeSources.filter(file => forbidden.test(file.content)).map(file => file.path)
if (offenders.length > 0) throw new Error(`Mobile runtime still contains legacy Supabase references: ${offenders.join(', ')}`)
if (forbidden.test(envExample)) throw new Error('mobile/.env.example still contains legacy Supabase configuration.')
if (forbidden.test(packageJson)) throw new Error('mobile/package.json still contains a legacy Supabase dependency.')
if (forbidden.test(packageLock)) throw new Error('mobile/package-lock.json still contains a legacy Supabase dependency.')
if (!authSource.includes('refreshInFlight') || !authSource.includes("'Authorization'")) {
  throw new Error('Mobile first-party auth must retain single-flight Bearer refresh.')
}
if (!lessonSource.includes("'/platform/dashboard'") || !lessonSource.includes("'/platform/lessons'")) {
  throw new Error('Mobile dashboard and lesson reads must use first-party platform endpoints.')
}
if (!learningCacheSource.includes("@react-native-async-storage/async-storage") || !learningCacheSource.includes('MAX_CACHE_AGE_MS')) {
  throw new Error('Mobile lessons must use a bounded AsyncStorage cache.')
}
if (!learningCacheSource.includes('FORBIDDEN_FIELD') || !lessonSource.includes('cacheSafeLesson')) {
  throw new Error('Mobile cache must reject credentials/answer keys and strip material URLs.')
}
if (!authSource.includes('clearLearningCacheForUser')) {
  throw new Error('Native sign-out must clear the current user learning cache.')
}

console.log('Mobile first-party data-plane checks passed.')
