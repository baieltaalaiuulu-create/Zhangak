import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: 'https://zhangak.com/' },
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children
}
