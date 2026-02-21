import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JARVIS",
  description: "Автономный конвейер валидации бизнес-идей",
};

function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b"
      style={{
        background: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "saturate(180%) blur(20px)",
        WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderColor: "rgba(255, 255, 255, 0.08)",
      }}
    >
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-12">
        <span className="text-sm font-semibold tracking-tight text-white/90">
          JARVIS
        </span>
        <div className="flex gap-6">
          {[
            { label: "Главная", href: "/" },
            { label: "Исследования", href: "/research-center" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs text-white/50 hover:text-white/90 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-black text-[#f5f5f7] antialiased">
        <Navbar />
        <main className="pt-12">{children}</main>
      </body>
    </html>
  );
}
