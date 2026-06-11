import { listProducts } from "@/lib/catalog";
import { heroEyebrow } from "@/lib/series";
import { getSeriesState } from "@/lib/series-store";
import FinalsTracker from "@/app/components/FinalsTracker";
import ProductCard from "@/app/components/ProductCard";
import { ViewContent } from "@/app/components/PixelEvents";

// Re-render with fresh series data from Supabase (the cron writes it); ISR window.
export const revalidate = 120;

// The "Trump killed the vibes" Knicks-in-5 tee is the headliner.
const HERO_LINES = [
  "MY MAYOR MUSLIM",
  "MY BAGELS JEWISH",
  "TRUMP KILLED THE VIBES",
  "KNICKS IN 5",
];

// Product keys that belong to the dedicated "Knicks in 5" section.
const KNICKS5 = ["knicks-in-five", "cream-cheese-chive"];

export default async function Home() {
  const all = listProducts();
  const series = await getSeriesState();

  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  const knicks5 = KNICKS5.map((k) => byId[k]).filter(Boolean);
  const rest = all.filter((p) => !KNICKS5.includes(p.id));

  // Headliner = the "Trump killed the vibes" tee (falls back to first product).
  const hero = byId["knicks-in-five"] ?? all[0];
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

          {/* Full-width headline so each line (incl. "TRUMP KILLED THE VIBES")
              stays on one line; the clamp scales it to fit any viewport. */}
          <h1 className="font-display uppercase leading-[0.95] tracking-tight text-[clamp(1.5rem,7vw,4.75rem)]">
            {HERO_LINES.map((line, i) => (
              <span
                key={i}
                className={`block whitespace-nowrap ${i === HERO_LINES.length - 1 ? "text-orange" : ""}`}
              >
                {line}
              </span>
            ))}
          </h1>

          <div className="mt-10 grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="max-w-md text-lg text-white/75">
                Officially unofficial New York fan merch. New drop every day of the run
                — free shipping from New Jersey.
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
                  <img src={heroImage} alt={hero.name} className="w-full" />
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
              The headliner · new drop every day
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
