import { Stack } from 'expo-router'
import { NativeAuthProvider } from '@/components/NativeAuthProvider'

// Both route groups are always registered here; the actual auth gate
// lives in (student)/_layout.tsx (redirects to /login when signed out)
// and login.tsx (redirects away from itself when already signed in). The
// first-party bearer session is restored once at the app root.
export default function RootLayout() {
  return (
    <NativeAuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
      </Stack>
    </NativeAuthProvider>
  )
}
