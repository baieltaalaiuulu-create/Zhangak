import type { MetadataRoute } from 'next'

// Next.js native manifest route (App Router metadata convention) — serves
// at /manifest.webmanifest with the correct content-type automatically.
// Replaces the old static public/manifest.json, which Chrome's PWA
// installability check was treating unreliably (showing "Создать ярлык"
// instead of "Установить приложение").
//
// start_url is the dedicated /launch route, not the marketing landing page
// ('/') and not the student dashboard ('/student/online', which is
// client-auth-gated and 404-risk-prone on a cold PWA start). '/launch'
// always renders instantly (a splash, no data dependency) and decides —
// session → dashboard, no session + onboarding seen → /login, no session +
// first run → /onboarding — see app/launch/page.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZHANGAK',
    short_name: 'ZHANGAK',
    description: 'Онлайн подготовка к ОРТ в Кыргызстане',
    start_url: '/launch',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0D0D1A',
    theme_color: '#1B4FD8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
