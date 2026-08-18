import { redirect } from 'next/navigation'

// Mock exams use the same first-party, server-scored attempt flow as practice.
// The former Supabase screen is intentionally retired rather than leaving an
// authenticated learner on a broken or client-scored route.
export default function MockOrtPage() {
  redirect('/student/online/practice?type=mock')
}
