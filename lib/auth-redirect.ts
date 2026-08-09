import type { useRouter } from 'next/navigation'

// Shared by app/page.tsx's mount-time session check + inline login modal,
// and app/login/page.tsx's dedicated login form — one source of truth for
// where each role lands after authenticating.
// `fallbackHref` is only used after an active login submission (an
// unrecognized-but-signed-in role still lands somewhere); a passive
// mount-time auto-redirect passes none, so an unrecognized role there just
// leaves the visitor on whatever public page they're already looking at.
export function redirectForRole(
  role: string | undefined,
  studentType: string | undefined,
  router: ReturnType<typeof useRouter>,
  fallbackHref?: string
): void {
  if (role === 'admin') router.push('/admin')
  else if (role === 'super_admin') router.push('/admin')
  else if (role === 'admin_jr') router.push('/admin/jr')
  else if (role === 'teacher') router.push('/teacher')
  else if (role === 'manager') router.push('/manager')
  else if (role === 'director') router.push('/director')
  else if (role === 'finance') router.push('/finance')
  else if (role === 'math_admin') router.push('/math/admin')
  else if (role === 'math_student') router.push('/math/student')
  else if (role === 'math_parent') router.push('/math/parent')
  else if (role === 'student' && studentType === 'online') router.push('/student/online')
  else if (role === 'student') router.push('/student')
  else if (fallbackHref) router.push(fallbackHref)
}
