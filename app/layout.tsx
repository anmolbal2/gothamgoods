import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import { SERIES } from "@/lib/series";
import { CartProvider, CartButton, CartDrawer } from "@/app/components/cart";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const anton = Anton({ weight: "400", variable: "--font-anton", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gotham Goods — Knicks Finals Fan Tees, Shipped from NJ",
  description:
    "Knicks finals-run fan tees. Heavyweight cotton, shipped from New Jersey in 2–3 days. Fan-made — not affiliated with the NBA or any team.",
};

function Ticker() {
  const Row = () => (
    <div className="flex shrink-0 items-center">
      {SERIES.tickerItems.map((t, i) => (
        <span key={i} className="flex items-center">
          <span className="px-6 py-2 font-mono text-xs uppercase tracking-[0.22em]">
            {t}
          </span>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="overflow-hidden border-b-2 border-ink bg-ink text-cream">
      <div className="flex w-max gg-marquee">
        <Row />
        <Row />
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream">
        <CartProvider>
          <Ticker />

          <header className="sticky top-0 z-30 border-b-2 border-ink bg-cream/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
              <Link href="/" className="flex items-baseline gap-2.5">
                <span className="font-display text-2xl uppercase tracking-tight text-ink">
                  Gotham Goods
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-orange">
                  New York
                </span>
              </Link>
              <CartButton />
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t-2 border-ink bg-ink text-cream">
            <div className="mx-auto max-w-6xl px-5 py-12">
              <p className="font-display text-2xl uppercase tracking-tight">Gotham Goods</p>
              <p className="mt-2 max-w-md text-sm text-cream/60">
                Officially unofficial New York fan merch. Shipped from New Jersey
                in 2–3 days.
              </p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-cream/40">
                © {year} Gotham Goods · Fan-made. Not affiliated with the NBA, any team,
                or any brand.
              </p>
            </div>
          </footer>

          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
