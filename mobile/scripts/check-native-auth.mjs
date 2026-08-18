import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

const mobileRoot = resolve(import.meta.dirname, '..')

async function source(relativePath) {
  return readFile(resolve(mobileRoot, relativePath), 'utf8')
}

async function sourceFiles(directory) {
  const absolute = resolve(mobileRoot, directory)
  const entries = await readdir(absolute, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const child = resolve(absolute, entry.name)
    if (entry.isDirectory()) return sourceFiles(relative(mobileRoot, child))
    if (!/\.(?:[cm]?[jt]sx?|json)$/i.test(entry.name)) return []
    return [{ path: relative(mobileRoot, child).replaceAll('\\', '/'), content: await readFile(child, 'utf8') }]
  }))
  return files.flat()
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const [auth, provider, rootLayout, login, studentLayout, appConfig, envExample, packageJson, packageLock, runtimeSources] = await Promise.all([
  source('lib/native-auth.ts'),
  source('components/NativeAuthProvider.tsx'),
  source('app/_layout.tsx'),
  source('app/(auth)/login.tsx'),
  source('app/(student)/_layout.tsx'),
  source('app.json'),
  source('.env.example'),
  source('package.json'),
  source('package-lock.json'),
  Promise.all(['app', 'components', 'lib'].map(sourceFiles)).then(groups => groups.flat()),
])

assert(auth.includes("from 'expo-secure-store'"), 'Native auth must use Expo SecureStore.')
assert(auth.includes("Platform.OS === 'web'"), 'The native companion must fail closed when opened as a web app.')
assert(auth.includes("'Authorization'"), 'Native auth must send a Bearer Authorization header.')
assert(auth.includes('refreshInFlight'), 'Native auth must keep refresh single-flight.')
assert(auth.includes("'/auth/refresh'"), 'Native auth must use the first-party refresh endpoint.')
assert(auth.includes("'/auth/login'"), 'Native auth must use the first-party login endpoint.')
assert(auth.includes("'/auth/logout'"), 'Native auth must use the first-party logout endpoint.')
assert(auth.includes("user?.role === 'student' && user.studentType === 'online'"), 'Only online students must be allowed into the native app.')
assert(auth.includes('if (!isSupportedNativeStudent(user))'), 'A restored session must be rechecked against the native student audience.')
assert(!/password\s*[:=].*SecureStore|SecureStore[^\n]*password/i.test(auth), 'Passwords must not be persisted in SecureStore.')
assert(provider.includes('restoreNativeSession'), 'The provider must restore the first-party session.')
assert(rootLayout.includes('NativeAuthProvider'), 'The app root must mount the native auth provider.')
assert(login.includes('signIn(email, password)'), 'The login screen must use first-party native sign-in.')
assert(studentLayout.includes('useNativeAuth'), 'The student auth guard must use the native session.')
const forbidden = /@supabase\/|\bsupabase\b|EXPO_PUBLIC_SUPABASE|react-native-get-random-values/i
const forbiddenFiles = runtimeSources.filter(file => forbidden.test(file.content)).map(file => file.path)
assert(forbiddenFiles.length === 0, `Mobile runtime still contains legacy Supabase references: ${forbiddenFiles.join(', ')}`)
assert(envExample.includes('EXPO_PUBLIC_ZHANGAK_API_URL=https://platform.zhangak.com/v1'), 'The API URL must be documented in the mobile env example.')
assert(JSON.parse(packageJson).scripts['check:auth'], 'The mobile auth contract check must be runnable.')
assert(!JSON.parse(packageJson).scripts.web, 'The native companion must not advertise an unsupported web command.')
assert(!/"web"\s*:/.test(appConfig), 'The native Expo config must not advertise a web build.')
assert(!forbidden.test(envExample), 'The mobile env example must not contain legacy Supabase variables.')
assert(!forbidden.test(packageJson), 'The mobile package manifest must not contain the legacy SDK.')
assert(!forbidden.test(packageLock), 'The mobile dependency lock must not contain the legacy SDK.')

console.log('Native first-party auth contract checks passed.')
