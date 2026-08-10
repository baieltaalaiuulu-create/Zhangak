import type { MetadataRoute } from 'next'

// Next.js native manifest route (App Router metadata convention) — serves
// at /manifest.webmanifest with the correct content-type automatically.
// Replaces the old static public/manifest.json, which Chrome's PWA
// installability check was treating unreliably (showing "Создать ярлык"
// instead of "Установить приложение").
//
// start_url is '/' — the root route (app/page.tsx) is a lightweight smart
// router, not the marketing landing page (that content now lives at
// /landing) and not the student dashboard ('/student/online', which is
// client-auth-gated and 404-risk-prone on a cold PWA start). '/' always
// renders instantly (a splash, no data dependency) and decides — session
// → dashboard; no session, running as the installed PWA (display-mode
// check, not viewport width — a phone visiting in Chrome is still a
// browser visit) + onboarding seen → /login, + first run → /onboarding;
// no session in a regular browser → /landing — see app/page.tsx.
// (Previously start_url pointed at a dedicated /launch route that did the
// same job; that route has been deleted now that '/' handles it
// directly.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZHANGAK',
    short_name: 'ZHANGAK',
    description: 'Онлайн подготовка к ОРТ в Кыргызстане',
    start_url: '/',
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
