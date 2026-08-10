import type { useRouter } from 'next/navigation'

// Shared by app/page.tsx's mount-time session check + inline login modal,
// app/login/page.tsx's dedicated login form, and app/launch/page.tsx's PWA
// entry point — one source of truth for where each role lands after
// authenticating.
// `fallbackHref` is only used after an active login submission (an
// unrecognized-but-signed-in role still lands somewhere); a passive
// mount-time auto-redirect passes none, so an unrecognized role there just
// leaves the visitor on whatever public page they're already looking at.
//
// Uses router.replace rather than router.push everywhere: every call site
// is an auto-redirect away from a page that shouldn't be revisited via the
// back button (landing/login/launch once already authenticated), so the
// entry itself shouldn't linger in history.
export function redirectForRole(
  role: string | undefined,
  studentType: string | undefined,
  router: ReturnType<typeof useRouter>,
  fallbackHref?: string
): void {
  if (role === 'admin') router.replace('/admin')
  else if (role === 'super_admin') router.replace('/admin')
  else if (role === 'admin_jr') router.replace('/admin/jr')
  else if (role === 'teacher') router.replace('/teacher')
  else if (role === 'manager') router.replace('/manager')
  else if (role === 'director') router.replace('/director')
  else if (role === 'finance') router.replace('/finance')
  else if (role === 'math_admin') router.replace('/math/admin')
  else if (role === 'math_student') router.replace('/math/student')
  else if (role === 'math_parent') router.replace('/math/parent')
  else if (role === 'student' && studentType === 'online') router.replace('/student/online')
  else if (role === 'student') router.replace('/student')
  else if (fallbackHref) router.replace(fallbackHref)
}
