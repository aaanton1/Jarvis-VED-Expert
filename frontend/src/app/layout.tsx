import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jarvis VED Expert — AI-брокер для белого импорта",
  description:
    "Считаем пошлины, проверяем риски Честного ЗНАКа и готовим документы за 5 минут. Дешевле юриста, быстрее брокера.",
  verification: {
    google: "google0ab32bf04b70e72a",
    yandex: "e25f7dad06c1f915",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
