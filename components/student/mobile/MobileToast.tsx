'use client'

interface Props {
  message: string | null
}

// Bottom toast for quick, non-blocking feedback (e.g. tapping a locked
// lesson). Positioned above the BottomNav; mobile-only.
export default function MobileToast({ message }: Props) {
  if (!message) return null
  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg md:hidden"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {message}
    </div>
  )
}
