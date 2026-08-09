export const dynamic = 'force-dynamic'

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhangak.kg"),
  title: {
    default: "Жангак — платформа подготовки к ОРТ (ЖРТ) в Кыргызстане",
    template: "%s | Жангак",
  },
  description:
    "Жангак — платформа подготовки к ОРТ (ЖРТ) для школьников Кыргызстана. Курсы по математике, аналогиям, чтению и кыргызскому языку, тренажёры, пробные тесты и персональный AI-наставник.",
  keywords: ["ОРТ", "ЖРТ", "Жангак", "Кыргызстан", "подготовка к ОРТ", "пробный ОРТ", "курсы Бишкек", "ЖРТ тест"],
  openGraph: {
    title: "Жангак — платформа подготовки к ОРТ (ЖРТ)",
    description:
      "Жангак готовит школьников Кыргызстана к ОРТ (ЖРТ): курсы, тренажёры, пробные тесты и AI-наставник.",
    url: "https://zhangak.kg",
    siteName: "Жангак",
    locale: "ru_RU",
    type: "website",
  },
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