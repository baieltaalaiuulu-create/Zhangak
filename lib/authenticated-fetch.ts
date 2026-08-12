import { supabase } from '@/lib/supabase'

/** Adds the current Supabase access token to same-origin protected API calls. */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (typeof window === 'undefined') {
    throw new Error('authenticatedFetch is a browser-only helper')
  }

  const rawUrl = input instanceof Request ? input.url : input instanceof URL ? input.href : input
  const requestedUrl = new URL(rawUrl, window.location.origin)
  if (requestedUrl.origin !== window.location.origin) {
    throw new Error('authenticatedFetch supports same-origin requests only')
  }

  const headers = new Headers(init.headers)
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`)
  }

  return fetch(input, { ...init, headers })
}
