import "./globals.css";

export const metadata = {
  title: "PactoCoins",
  description: "Внутренняя система коинов отдела продаж",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
