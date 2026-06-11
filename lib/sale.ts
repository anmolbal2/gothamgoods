/**
 * Campaign config for the Game-4 comeback flash sale (Knicks erased a 29-point
 * deficit, so everything is 29% off). Pure constants — safe to import from both
 * server and client components.
 *
 * The CHARGED price lives in the catalog (lib/catalog.ts priceCents = $35.49,
 * compareAtCents = $49.99 list). This module only controls the campaign DISPLAY
 * (ticker lines, banner, badges, Stripe note). Display is gated on SALE.active —
 * never on time — so the UI can never advertise a sale the checkout isn't charging.
 *
 * ===== HOW TO END THE SALE (runbook) =====
 * 1. scripts/gen-catalog.mjs: set SALE_PCT = 0  (priceCents becomes $49.99 list)
 * 2. This file: set active: false
 * 3. node --env-file=.env.local scripts/gen-catalog.mjs   (regenerates lib/catalog.ts)
 * 4. Commit + push to main (deploys). Feeds/checkout/UI all flip together.
 */
export const SALE = {
  active: true,
  pct: 29,
  headline: "DOWN 29. WON ANYWAY.",
  sub: "Game 4 · the comeback",
  // Shown on the Stripe Checkout page under each line item.
  stripeNote: "29% Knicks comeback sale — list $49.99",
  // Fallback end target for the countdown; pages prefer the live Game 5 tip-off
  // from series state. Sat Jun 13, 8:30 PM ET.
  endISO: "2026-06-14T00:30:00Z",
};

/** Ticker lines prepended to the marquee while the sale runs. */
export function saleTickerItems(): string[] {
  return SALE.active
    ? ["DOWN 29. WON ANYWAY.", "29% COMEBACK SALE — EVERYTHING $35.49"]
    : [];
}
