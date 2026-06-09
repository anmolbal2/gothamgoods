import { listProducts, type Size } from "@/lib/catalog";
import { SERIES } from "@/lib/series";
import TeeMockup from "@/app/components/TeeMockup";
import FinalsTracker from "@/app/components/FinalsTracker";
import { AddToCart } from "@/app/components/cart";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Home() {
  const products = listProducts();
  const hero = products[0];

  return (
    <>
      {/* HERO */}
      <section className="bg-blue text-white">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.25em] text-orange">
            Back page · The Finals Drop · {SERIES.teamName} up {SERIES.wins}–
            {SERIES.losses}
          </p>

          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h1 className="font-display text-5xl uppercase leading-[0.9] tracking-tight sm:text-6xl md:text-7xl">
                {hero.design?.lines.map((line, i) => (
                  <span
                    key={i}
                    className={`block ${
                      i === hero.design?.accentLineIndex ? "text-orange" : ""
                    }`}
                  >
                    {line}
                  </span>
                ))}
              </h1>
              {hero.blurb && (
                <p className="mt-6 max-w-md text-lg text-white/75">{hero.blurb}</p>
              )}
            </div>

            <div className="px-6">
              {hero.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hero.image} alt={hero.name} className="mx-auto w-full max-w-md" />
              ) : hero.design ? (
                <TeeMockup design={hero.design} size="lg" className="max-w-md" />
              ) : null}
            </div>
          </div>

          {/* Featured buy card */}
          <div
            data-testid="product-card"
            data-product={hero.id}
            className="mt-12 grid gap-6 border-2 border-white/15 bg-blue-deep p-6 sm:grid-cols-[1fr_18rem] sm:items-center"
          >
            <div>
              {hero.tagline && (
                <span className="inline-block bg-orange px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-ink">
                  {hero.tagline}
                </span>
              )}
              <h2
                data-testid="product-name"
                className="mt-3 font-display text-3xl uppercase tracking-tight"
              >
                {hero.name}
              </h2>
              <p className="mt-1 font-mono text-sm uppercase tracking-widest text-white/60">
                Unisex heavyweight tee · runs true to size
              </p>
            </div>
            <div>
              <p className="mb-3 font-display text-3xl text-orange">
                {money(hero.priceCents)}
              </p>
              <AddToCart
                productId={hero.id}
                sizes={Object.keys(hero.variants) as Size[]}
                priceCents={hero.priceCents}
                variant="hero"
              />
            </div>
          </div>
        </div>
      </section>

      {/* LIVE FINALS TRACKER */}
      <FinalsTracker />

      {/* THE DROP */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-4">
          <h2 className="font-display text-4xl uppercase tracking-tight">The Drop</h2>
          <p className="font-mono text-xs uppercase tracking-widest text-ink/60">
            {products.length} {products.length === 1 ? "style" : "styles"} · more weekly
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article key={p.id} className="flex flex-col border-2 border-ink bg-paper">
              <div className="bg-blue p-6">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt={p.name}
                    className="mx-auto aspect-square w-full max-w-[220px] object-contain"
                  />
                ) : p.design ? (
                  <TeeMockup design={p.design} size="sm" className="max-w-[220px]" />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-5">
                {p.tagline && (
                  <span className="mb-2 inline-block self-start bg-orange px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
                    {p.tagline}
                  </span>
                )}
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl uppercase tracking-tight">
                    {p.name}
                  </h3>
                  <span className="font-display text-xl text-orange">
                    {money(p.priceCents)}
                  </span>
                </div>
                {p.blurb && (
                  <p className="mt-2 line-clamp-3 text-sm text-ink/70">{p.blurb}</p>
                )}
                <div className="mt-auto pt-4">
                  <AddToCart
                    productId={p.id}
                    sizes={Object.keys(p.variants) as Size[]}
                    priceCents={p.priceCents}
                    variant="card"
                  />
                </div>
              </div>
            </article>
          ))}

          {/* Teaser tile — clearly not purchasable */}
          <article className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink/30 bg-cream p-10 text-center">
            <span className="font-display text-2xl uppercase tracking-tight text-ink/40">
              Dropping next
            </span>
            <p className="font-mono text-xs uppercase tracking-widest text-ink/40">
              New tee every week of the run
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
