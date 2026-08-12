export const dynamic = 'force-dynamic'

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import PWAInstallProvider from "@/components/PWAInstallProvider";
import ResourceHints from "@/components/ResourceHints";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhangak.com"),
  title: {
    default: "Жангак — платформа подготовки к ОРТ (ЖРТ) в Кыргызстане",
    template: "%s | Жангак",
  },
  description:
    "Жангак — платформа подготовки к ОРТ (ЖРТ) для школьников Кыргызстана. Курсы по математике, аналогиям, чтению и кыргызскому языку, тренажёры, пробные тесты и персональный AI-наставник.",
  keywords: ["ОРТ", "ЖРТ", "Жангак", "Кыргызстан", "подготовка к ОРТ", "пробный ОРТ", "курсы Бишкек", "ЖРТ тест"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ZHANGAK",
  },
  icons: {
    apple: "/icons/icon-512.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Жангак — платформа подготовки к ОРТ (ЖРТ)",
    description:
      "Жангак готовит школьников Кыргызстана к ОРТ (ЖРТ): курсы, тренажёры, пробные тесты и AI-наставник.",
    url: "https://zhangak.com",
    siteName: "Жангак",
    locale: "ru_RU",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B4FD8",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <ResourceHints />
        <PWAInstallProvider>
          {children}
        </PWAInstallProvider>
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
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
