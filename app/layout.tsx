import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";
import { buildTickerItems } from "@/lib/series";
import { getSeriesState } from "@/lib/series-store";
import { CartProvider, CartButton, CartDrawer } from "@/app/components/cart";
import { PixelPageView } from "@/app/components/PixelEvents";

// Re-render with fresh series data from Supabase (the cron writes it); ISR window.
export const revalidate = 120;

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const META_DOMAIN_VERIFICATION = process.env.META_DOMAIN_VERIFICATION;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const anton = Anton({ weight: "400", variable: "--font-anton", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gotham Goods — Knicks Finals Fan Tees, Shipped from NJ",
  description:
    "Knicks finals-run fan tees. Heavyweight cotton, shipped from New Jersey in 2–3 days. Fan-made — not affiliated with the NBA or any team.",
  // Meta Business domain verification — renders <meta name="facebook-domain-verification">.
  ...(META_DOMAIN_VERIFICATION
    ? { verification: { other: { "facebook-domain-verification": META_DOMAIN_VERIFICATION } } }
    : {}),
};

function Ticker({ items }: { items: string[] }) {
  const Row = () => (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();
  const series = await getSeriesState();
  const tickerItems = buildTickerItems(series);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full scroll-smooth antialiased`}
    >
      <body className="flex min-h-full flex-col bg-cream">
        {META_PIXEL_ID ? (
          <Script id="meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
          </Script>
        ) : null}
        <CartProvider>
          <PixelPageView />
          <Ticker items={tickerItems} />

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
                Officially unofficial New York fan merch. Free shipping, straight
                from New Jersey in 2–3 days.
              </p>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-cream/40">
                © {year} Gotham Goods · Fan-made. Not affiliated with the NBA, any team,
                or any brand.
              </p>
              <Link
                href="/privacy"
                className="mt-3 inline-block font-mono text-[11px] uppercase tracking-widest text-cream/60 underline hover:text-cream"
              >
                Privacy Policy
              </Link>
            </div>
          </footer>

          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
