import 'react-native-get-random-values'
import { AppState } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { createClient } from '@supabase/supabase-js'

// Same Supabase project as the web app (olqikkvjeutdgewmhnub) — same
// tables, same RLS, same auth users. EXPO_PUBLIC_* vars are inlined into
// the client bundle by Metro at build time (see .env.example).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing env: EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}, EXPO_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey ? '(set)' : supabaseAnonKey}`)
}

// expo-secure-store backs the session in the iOS Keychain / Android
// Keystore (encrypted at rest), matching the web client's persistSession
// behavior but with OS-level secure storage instead of localStorage.
// Note: SecureStore has a ~2048 byte per-value limit on iOS — a Supabase
// session (access + refresh JWT) normally fits comfortably within that.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    storageKey: 'zhangak-auth',
    persistSession: true,
    autoRefreshToken: true,
    // No browser URL to parse magic-link/OAuth tokens from in React Native.
    detectSessionInUrl: false,
  },
})

// Supabase's auto token refresh is driven by a timer that should only run
// while the app is in the foreground — this is the standard React Native
// wiring recommended for supabase-js (mirrors the equivalent behavior the
// web client gets for free from the browser tab visibility API).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

// ── Shared types — same shape as the tables lib/lessons-data.ts,
// lib/student-data.ts, and lib/dashboard-data.ts already query on the web
// side (practice_lessons / practice_results / profiles), not the legacy
// offline-cohort tables (courses/lessons/groups) the old web client also
// exports, which the online student cabinet doesn't use. ──────────────────

export type UserRole = 'student' | 'admin' | 'super_admin' | 'admin_jr' | 'teacher' | 'manager' | 'director' | 'finance'
export type StudentType = 'online' | 'offline'
export type LessonSubject = 'math' | 'kyr'
export type LessonStatus = 'done' | 'current' | 'locked'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  student_type: StudentType | null
  target_score: number | null
  avatar_url: string | null
}

export interface PracticeLesson {
  id: string
  title: string
  description: string | null
  subject: LessonSubject
  video_url: string | null
  order_number: number
}

export interface PracticeResult {
  id: number
  student_id: string
  lesson_id: string | null
  test_id: number | null
  test_type: 'practice' | 'mock'
  score: number | null
  total_score: number | null
  completed_at: string | null
}
