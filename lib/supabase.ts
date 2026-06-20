import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing env: URL=${supabaseUrl}, KEY=${supabaseAnonKey}`)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'zhangak-auth',
  }
})

export type UserRole = 'admin' | 'teacher' | 'student'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  phone: string
  created_at: string
}

export interface Course {
  id: number
  name: string
  level: string
  description: string
  month: string
}

export interface Lesson {
  id: number
  course_id: number
  lesson_number: number
  title: string
  math_topic: string
  kyr_topic: string
  reading_topic: string
  duration_minutes: number
  lesson_date: string
  is_test: boolean
}

export interface Group {
  id: number
  name: string
  course_id: number
  teacher_id: string
}

export interface Attendance {
  id: number
  lesson_id: number
  student_id: string
  status: 'present' | 'absent' | 'late'
  note: string
}

export interface TestResult {
  id: number
  lesson_id: number
  student_id: string
  math_score: number
  analogy_score: number
  reading_score: number
  grammar_score: number
  total_score: number
}