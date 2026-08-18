export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import PWAInstallProvider from "@/components/PWAInstallProvider";
import CookieInformationNotice from "@/components/CookieInformationNotice";
import ResourceHints from "@/components/ResourceHints";
import { ADMIN_ORIGIN, MARKETING_ORIGIN, PLATFORM_ORIGIN, siteSurfaceForHost } from "@/lib/site-hosts";
import "./globals.css";

const description = "Жангак — платформа подготовки к ОРТ (ЖРТ) для школьников Кыргызстана. Курсы по математике, аналогиям, чтению и кыргызскому языку, тренажёры, пробные тесты и персональный AI-наставник."
const brandIconVersion = '20260813'
const brandIcon = (path: string) => `${path}?v=${brandIconVersion}`

const brandIcons: Metadata['icons'] = {
  icon: [
    { url: brandIcon('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
    { url: brandIcon('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
  ],
  shortcut: brandIcon('/icons/icon-192.png'),
  apple: [{ url: brandIcon('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' }],
}

export async function generateMetadata(): Promise<Metadata> {
  const host = (await headers()).get('host')
  const surface = siteSurfaceForHost(host)

  if (surface === 'platform') {
    return {
      metadataBase: new URL(PLATFORM_ORIGIN),
      title: { default: 'Жангак — учебная платформа', template: '%s | Жангак' },
      description,
      manifest: `/platform.webmanifest?v=${brandIconVersion}`,
      robots: { index: false, follow: false, nocache: true },
      appleWebApp: { capable: true, statusBarStyle: 'default', title: 'ZHANGAK' },
      icons: brandIcons,
      other: { 'mobile-web-app-capable': 'yes' },
    }
  }

  if (surface === 'admin') {
    return {
      metadataBase: new URL(ADMIN_ORIGIN),
      title: { default: 'Жангак — управление', template: '%s | Жангак' },
      description: 'Защищённая панель управления платформой Жангак.',
      robots: { index: false, follow: false, nocache: true },
      icons: brandIcons,
    }
  }

  return {
    metadataBase: new URL(MARKETING_ORIGIN),
    title: {
      default: "Жангак — подготовка к ОРТ (ЖРТ) в Кыргызстане",
      template: "%s | Жангак",
    },
    description,
    keywords: ["ОРТ", "ЖРТ", "Жангак", "Кыргызстан", "подготовка к ОРТ", "пробный ОРТ", "курсы Бишкек", "ЖРТ тест"],
    robots: { index: true, follow: true },
    icons: brandIcons,
    openGraph: {
      title: "Жангак — подготовка к ОРТ (ЖРТ)",
      description: "Курсы, тренажёры, пробные тесты и AI-наставник для школьников Кыргызстана.",
      url: MARKETING_ORIGIN,
      siteName: "Жангак",
      locale: "ru_RU",
      type: "website",
    },
  }
}

export const viewport: Viewport = {
  themeColor: "#1B3F92",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,500,0..1,0&display=swap"
        />
      </head>
      <body>
        <ResourceHints />
        <PWAInstallProvider>
          {children}
        </PWAInstallProvider>
        <CookieInformationNotice />
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              var platformHosts = ['platform.zhangak.com', 'preprod.zhangak.com', 'localhost', '127.0.0.1'];
              if ('serviceWorker' in navigator && platformHosts.indexOf(window.location.hostname) !== -1) {
                navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(function(reg) {
                  reg.addEventListener('updatefound', function() {
                    var newSW = reg.installing;
                    if (!newSW) return;
                    newSW.addEventListener('statechange', function() {
                      if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                        newSW.postMessage('skipWaiting');
                      }
                    });
                  });
                }).catch(function(e) { console.log('SW fail', e); });
                navigator.serviceWorker.addEventListener('controllerchange', function() {
                  window.location.reload();
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
