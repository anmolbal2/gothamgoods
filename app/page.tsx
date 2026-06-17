import { listProducts } from "@/lib/catalog";
import { heroEyebrow } from "@/lib/series";
import { getSeriesState } from "@/lib/series-store";
import FinalsTracker from "@/app/components/FinalsTracker";
import ProductCard from "@/app/components/ProductCard";
import { ViewContent } from "@/app/components/PixelEvents";

// Re-render with fresh series data from Supabase (the cron writes it); ISR window.
export const revalidate = 120;

// The "Pope's on our side" Knicks-in-5 tee is the headliner.
const HERO_LINES = [
  "MY MAYOR MUSLIM",
  "MY BAGELS JEWISH",
  "POPE'S ON OUR SIDE",
  "KNICKS IN 5",
];

// Product keys for the dedicated "Knicks in 5" section, in priority order.
// Genuine "Knicks in 5" shirts stay in the top section. The two Brunson MVP tees
// are NOT Knicks-in-5 — they lead the grid below as the top non-Knicks-in-5 items
// (they're first in the catalog order, so they sort to the front of `rest`).
const KNICKS5 = [
  "popes-on-our-side",
  "saturday-night-live",
  "knicks-in-five",
  "cream-cheese-chive",
];

export default async function Home() {
  const all = listProducts();
  const series = await getSeriesState();

  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  const knicks5 = KNICKS5.map((k) => byId[k]).filter(Boolean);
  const rest = all.filter((p) => !KNICKS5.includes(p.id));

  // Headliner = the "Pope's on our side" tee (falls back to first product).
  const hero = byId["popes-on-our-side"] ?? all[0];
  const heroImage = hero?.colors[0]?.image;

  return (
    <>
      {hero ? (
        <ViewContent productId={hero.id} valueCents={hero.priceCents} />
      ) : null}

      {/* HERO */}
      <section className="bg-blue text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-orange">
            {heroEyebrow(series)}
          </p>

          {/* Balanced split: headline + copy on the left, product on the right.
              Headline keeps its original size; the left column is just wide enough
              for "TRUMP KILLED THE VIBES" (~623px at text-7xl) on one line, so the
              image column takes the rest (bigger image, minimal gap). */}
          <div className="grid items-center gap-8 lg:grid-cols-[648px_minmax(0,1fr)]">
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
                — free shipping from New Jersey.
              </p>
              <a
                href="#shop"
                className="mt-8 inline-block bg-orange px-6 py-3 font-mono text-sm font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright"
              >
                Shop the championship collection ↓
              </a>
            </div>

            <div>
              {heroImage ? (
                // Clip + scale the mockup to crop the whitespace around the shirt.
                <div className="mx-auto max-w-md overflow-hidden rounded-xl bg-white shadow-xl lg:max-w-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImage} alt={hero.name} className="w-full scale-[1.28]" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* LIVE FINALS TRACKER */}
      <FinalsTracker state={series} />

      {/* KNICKS IN 5 — the headlining collection */}
      {knicks5.length > 0 ? (
        <section id="shop" className="mx-auto max-w-6xl scroll-mt-24 px-5 pt-16">
          <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-4">
            <h2 className="font-display text-4xl uppercase tracking-tight">Knicks in 5</h2>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/60">
              The headliner · the shirt that called it
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {knicks5.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* THE REST OF THE DROP */}
      {rest.length > 0 ? (
        <section className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-4">
            <h2 className="font-display text-4xl uppercase tracking-tight">The Drop</h2>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/60">
              {rest.length} more styles
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-ink/40">
            New design drops every day of the finals run — check back daily.
          </p>
        </section>
      ) : null}
    </>
  );
}
