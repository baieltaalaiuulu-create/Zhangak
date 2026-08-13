import { redirect } from 'next/navigation'

// Results are rendered immediately from a submitted first-party attempt.
// A legacy Supabase result URL cannot safely be replayed after the cutover.
export default function LegacyMockResultsPage() {
  redirect('/student/online/practice?type=mock')
}
