export const dynamic = 'force-dynamic'

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Жангак — LMS",
  description: "Система управления обучением",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}