import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gotham Goods — Officially Unofficial NY Fan Merch",
  description:
    "Heavyweight NY fan tees, printed on demand and shipped from New Jersey in 2–3 days.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
              <span className="text-lg font-black tracking-tight">GOTHAM GOODS</span>
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-widest text-muted sm:block">
              Ships from NJ · 2–3 days
            </span>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-border bg-brand-ink text-white">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <p className="text-lg font-black tracking-tight">GOTHAM GOODS</p>
            <p className="mt-2 max-w-md text-sm text-white/60">
              Officially unofficial NY fan merch. Printed on demand, shipped from New
              Jersey.
            </p>
            <p className="mt-6 text-xs text-white/40">
              © {year} Gotham Goods · Not affiliated with any team, league, or
              organization.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
