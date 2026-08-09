import { Stack } from 'expo-router'

// Both route groups are always registered here; the actual auth gate
// lives in (student)/_layout.tsx (redirects to /login when signed out)
// and login.tsx (redirects away from itself when already signed in) —
// see lib/supabase.ts for the session storage this all reads from.
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(student)" />
    </Stack>
  )
}
