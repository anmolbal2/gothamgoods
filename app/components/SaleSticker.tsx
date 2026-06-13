import { SALE } from "@/lib/sale";

/**
 * Small persistent "sticker" pinned near the top corner of the site advertising
 * the comeback sale — the lightweight replacement for the full-screen takeover.
 * Stays put on scroll (below the header, above page content, below the cart
 * drawer) and scrolls the buyer to the sale section on click.
 */
export default function SaleSticker() {
  if (!SALE.active) return null;
  return (
    <a
      href="#shop"
      data-testid="sale-sticker"
      aria-label={`${SALE.pct}% off — Knicks comeback sale`}
      className="fixed right-3 top-24 z-30 flex h-[4.5rem] w-[4.5rem] -rotate-[10deg] flex-col items-center justify-center rounded-full border-2 border-ink bg-orange text-center text-ink shadow-xl transition-transform hover:-rotate-3 sm:right-5 sm:top-28 sm:h-24 sm:w-24"
    >
      <span className="font-display text-2xl leading-none sm:text-3xl">
        {SALE.pct}%
      </span>
      <span className="font-display text-xs leading-none sm:text-sm">OFF</span>
      <span className="mt-1 font-mono text-[7px] font-bold uppercase leading-none tracking-[0.15em] sm:text-[8px]">
        Comeback
      </span>
    </a>
  );
}
