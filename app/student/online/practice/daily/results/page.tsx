import { redirect } from 'next/navigation'

// No legacy browser-authored daily results are shown after the cutover.
export default function LegacyDailyResultsPage() {
  redirect('/student/online/practice/daily')
}
