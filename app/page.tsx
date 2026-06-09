import { listProducts, type Size } from "@/lib/catalog";
import BuyButton from "@/app/components/BuyButton";

function priceLabel(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

/** Branded placeholder shown until a real Printify mockup URL is set on the product. */
function MockupTile({ name }: { name: string }) {
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-brand-ink">
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, #ff5a1f, transparent 55%)",
        }}
      />
      <span className="relative px-6 text-center text-2xl font-black uppercase leading-tight tracking-tight text-white">
        {name}
      </span>
    </div>
  );
}

export default function Home() {
  const products = listProducts();

  return (
    <>
      {/* Hero */}
      <section className="bg-brand-ink text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" /> New York · Print on
            demand
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            Officially unofficial <span className="text-brand">NY fan merch.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/70">
            Heavyweight tees designed for the five boroughs. Printed on demand and
            shipped from New Jersey in 2–3 days.
          </p>
          <a
            href="#shop"
            className="mt-8 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white transition hover:opacity-90"
          >
            Shop the drop
          </a>
        </div>
      </section>

      {/* Collection grid */}
      <section id="shop" className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight">The collection</h2>
          <p className="text-sm text-muted">
            {products.length} styles · ships from NJ
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <article
              key={p.id}
              data-testid="product-card"
              data-product={p.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md"
            >
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt={p.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <MockupTile name={p.name} />
              )}

              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3
                    data-testid="product-name"
                    className="text-lg font-bold tracking-tight"
                  >
                    {p.name}
                  </h3>
                  <span className="shrink-0 rounded-md bg-background px-2 py-1 text-sm font-semibold">
                    {priceLabel(p.priceCents)}
                  </span>
                </div>

                {p.blurb && <p className="mt-2 text-sm text-muted">{p.blurb}</p>}

                <div className="mt-auto">
                  <BuyButton
                    productId={p.id}
                    sizes={Object.keys(p.variants) as Size[]}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
