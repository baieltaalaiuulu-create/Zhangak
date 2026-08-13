import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = file => readFile(path.join(root, file), 'utf8')
const failures = []
const expect = (condition, message) => { if (!condition) failures.push(message) }

const [login, client, proxyRoute, hostProxy, backendAuth] = await Promise.all([
  read('app/login/page.tsx'),
  read('lib/zhangak-auth-client.ts'),
  read('app/v1/auth/[action]/route.ts'),
  read('proxy.ts'),
  read('backend/src/auth.js'),
])

expect(!/supabase/i.test(`${login}\n${client}\n${proxyRoute}`), 'first-party login slice must not use Supabase')
expect(login.includes('loginZhangak') && login.includes('getCurrentZhangakUser') && login.includes('logoutZhangak'), 'login page must use the Zhangak session API')
expect(client.includes("fetch(`/v1/auth/${path}`"), 'auth client must use same-origin /v1/auth endpoints')
expect(client.includes("credentials: 'include'"), 'auth client must send HttpOnly cookies')
expect(!/localStorage|sessionStorage|accessToken|refreshToken/.test(client), 'browser auth client must not store or read session tokens')
expect(proxyRoute.includes("'http://127.0.0.1:3210'"), 'Next fallback proxy must target the private API')
expect(proxyRoute.includes('Object.hasOwn(METHODS, action)'), 'auth proxy must use an exact endpoint allowlist')
expect(proxyRoute.includes('MAX_BODY_BYTES = 64_000'), 'auth proxy body must be bounded')
expect(proxyRoute.includes('getSetCookie'), 'auth proxy must preserve separate Set-Cookie headers')
expect(hostProxy.includes("'workspace-auth-api'"), 'host router must isolate first-party auth from marketing')
expect(backendAuth.includes('if (req.headers.origin) return {}'), 'web sessions must keep tokens out of response JSON')

if (failures.length > 0) {
  console.error(`First-party auth check failed (${failures.length}):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('First-party auth check passed (HttpOnly cookies, exact proxy, no Supabase).')
}
