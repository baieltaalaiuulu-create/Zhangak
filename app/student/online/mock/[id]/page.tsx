import { redirect } from 'next/navigation'

// Legacy mock IDs belong to the retired Supabase data model. New mock tests
// are selected from the first-party catalog, which creates an owned attempt.
export default function LegacyMockExamPage() {
  redirect('/student/online/practice?type=mock')
}
