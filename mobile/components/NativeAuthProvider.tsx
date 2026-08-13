import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  currentNativeAuth,
  restoreNativeSession,
  signInNative,
  signOutNative,
  subscribeNativeAuth,
  type NativeAuthSnapshot,
} from '@/lib/native-auth'

interface NativeAuthContextValue extends NativeAuthSnapshot {
  signIn: typeof signInNative
  signOut: typeof signOutNative
  retrySessionCheck: typeof restoreNativeSession
}

const NativeAuthContext = createContext<NativeAuthContextValue | null>(null)

/**
 * Keeps every Expo Router route in sync with the first-party native session.
 * The actual token storage and refresh logic remains outside React so a
 * refresh is shared by API calls made from different screens.
 */
export function NativeAuthProvider({ children }: PropsWithChildren) {
  const [auth, setAuth] = useState<NativeAuthSnapshot>(currentNativeAuth)

  useEffect(() => {
    const unsubscribe = subscribeNativeAuth(setAuth)
    void restoreNativeSession()
    return unsubscribe
  }, [])

  const value = useMemo<NativeAuthContextValue>(() => ({
    ...auth,
    signIn: signInNative,
    signOut: signOutNative,
    retrySessionCheck: restoreNativeSession,
  }), [auth])

  return <NativeAuthContext.Provider value={value}>{children}</NativeAuthContext.Provider>
}

export function useNativeAuth() {
  const value = useContext(NativeAuthContext)
  if (!value) throw new Error('useNativeAuth must be used inside NativeAuthProvider')
  return value
}
