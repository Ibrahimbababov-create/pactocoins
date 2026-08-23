import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import TelegramInit from "@/components/TelegramInit";

export const metadata = {
  title: "PactoCoins",
  description: "Внутренняя система коинов отдела продаж",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <TelegramInit />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
