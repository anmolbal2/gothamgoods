"use client";

import { useState } from "react";
import { SIZE_ORDER, type Product, type Size } from "@/lib/catalog";
import { useCart } from "@/app/components/cart";
import ProductGallery from "@/app/components/ProductGallery";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductCard({
  product,
}: {
  product: Product & { id: string };
}) {
  const { add } = useCart();
  const [colorIdx, setColorIdx] = useState(0);
  const color = product.colors[colorIdx] ?? product.colors[0];
  const available = SIZE_ORDER.filter((s) => color.variants[s] !== undefined);
  const [size, setSize] = useState<Size>(
    available.includes("M") ? "M" : (available[0] ?? "M"),
  );
  const [added, setAdded] = useState(false);

  // Comeback sale: compareAtCents is the display-only list price; priceCents is charged.
  const onSale =
    product.compareAtCents !== undefined && product.compareAtCents > product.priceCents;
  const pctOff = onSale
    ? Math.round((1 - product.priceCents / product.compareAtCents!) * 100)
    : 0;

  function onAdd() {
    const s = color.variants[size] !== undefined ? size : available[0];
    add(product.id, color.name, s);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article
      data-testid="product-card"
      data-product={product.id}
      className="flex flex-col border-2 border-ink bg-paper"
    >
      <div className="relative bg-white p-4">
        <ProductGallery
          key={color.name}
          images={color.images}
          alt={`${product.name} — ${color.name}`}
        />
        {product.tagline && (
          <span className="pointer-events-none absolute left-4 top-4 z-20 bg-orange px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-ink">
            {product.tagline}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            data-testid="product-name"
            className="font-display text-xl uppercase tracking-tight"
          >
            {product.name}
          </h3>
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            {onSale ? (
              <span className="font-mono text-sm text-ink/40 line-through">
                {money(product.compareAtCents!)}
              </span>
            ) : null}
            <span className="font-display text-xl text-orange">
              {money(product.priceCents)}
            </span>
          </span>
        </div>
        <p className="mt-1 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-widest text-orange">
          <span>Free shipping</span>
          {onSale ? (
            <span className="sale-pulse bg-ink px-1.5 py-0.5 text-[10px] text-orange">
              {pctOff}% off
            </span>
          ) : null}
        </p>
        {product.blurb && (
          <p className="mt-2 line-clamp-2 text-sm text-ink/70">{product.blurb}</p>
        )}

        {/* Color picker */}
        <div className="mt-4">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Color · <span className="text-ink">{color.name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((c, i) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                aria-pressed={i === colorIdx}
                onClick={() => setColorIdx(i)}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  i === colorIdx
                    ? "border-orange ring-2 ring-orange/30"
                    : "border-ink/20 hover:border-ink/50"
                }`}
                style={{ backgroundColor: c.swatch }}
              />
            ))}
          </div>
        </div>

        {/* Size picker */}
        <div className="mt-4">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-widest text-ink/50">
            Size
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                aria-pressed={s === size}
                className={`min-w-10 border-2 px-2.5 py-1.5 font-mono text-xs font-bold uppercase transition ${
                  s === size
                    ? "border-orange bg-orange text-ink"
                    : "border-ink/20 text-ink hover:border-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          data-testid="add-to-cart"
          onClick={onAdd}
          className="mt-5 w-full bg-orange px-5 py-3.5 font-mono text-sm font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright"
        >
          {added ? "Added ✓" : `Add to cart — ${money(product.priceCents)}`}
        </button>
      </div>
    </article>
  );
}
