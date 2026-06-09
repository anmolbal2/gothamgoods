import { listProducts } from "@/lib/catalog";
import { heroEyebrow } from "@/lib/series";
import { getSeriesState } from "@/lib/series-store";
import FinalsTracker from "@/app/components/FinalsTracker";
import ProductCard from "@/app/components/ProductCard";

// Re-render with fresh series data from Supabase (the cron writes it); ISR window.
export const revalidate = 120;

const HERO_LINES = [
  "MY MAYOR MUSLIM",
  "MY BAGEL JEWISH",
  "MY CHRISTIAN DIOR",
  "KNICKS IN FOUR",
];

export default async function Home() {
  const products = listProducts();
  const series = await getSeriesState();
  const heroImage = products[0]?.colors[0]?.image;

  return (
    <>
      {/* HERO */}
      <section className="bg-blue text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-orange">
            {heroEyebrow(series)}
          </p>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="font-display text-5xl uppercase leading-[0.9] tracking-tight sm:text-6xl md:text-7xl">
                {HERO_LINES.map((line, i) => (
                  <span
                    key={i}
                    className={`block ${i === HERO_LINES.length - 1 ? "text-orange" : ""}`}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              <p className="mt-6 max-w-md text-lg text-white/75">
                Officially unofficial New York fan merch. New drop every day of the run
                — heavyweight Comfort Colors tees, free shipping from New Jersey.
              </p>
              <a
                href="#shop"
                className="mt-8 inline-block bg-orange px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright"
              >
                Shop the drop ↓
              </a>
            </div>

            <div className="px-6">
              {heroImage ? (
                <div className="mx-auto max-w-md overflow-hidden rounded-xl bg-white p-3 shadow-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImage} alt="Gotham Goods tee" className="w-full" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* LIVE FINALS TRACKER */}
      <FinalsTracker state={series} />

      {/* THE DROP */}
      <section id="shop" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-4">
          <h2 className="font-display text-4xl uppercase tracking-tight">The Drop</h2>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/60">
            {products.length} styles · new drop every day
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-ink/40">
          New design drops every day of the finals run — check back daily.
        </p>
      </section>
    </>
  );
}
