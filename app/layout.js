import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Unbounded, Onest } from "next/font/google";
import "./globals.css";
import TelegramInit from "@/components/TelegramInit";

// Unbounded — цифры, заголовки, логотип. Onest — весь остальной текст.
const unbounded = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["700", "800"],
  variable: "--font-unbounded",
  display: "swap",
});

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-onest",
  display: "swap",
});

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
    <html lang="ru" className={`${unbounded.variable} ${onest.variable}`}>
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
