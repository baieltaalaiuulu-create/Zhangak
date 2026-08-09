import type { MetadataRoute } from 'next'

// Next.js native manifest route (App Router metadata convention) — serves
// at /manifest.webmanifest with the correct content-type automatically.
// Replaces the old static public/manifest.json, which Chrome's PWA
// installability check was treating unreliably (showing "Создать ярлык"
// instead of "Установить приложение").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZHANGAK',
    short_name: 'ZHANGAK',
    description: 'Онлайн подготовка к ОРТ в Кыргызстане',
    start_url: '/student/online',
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
