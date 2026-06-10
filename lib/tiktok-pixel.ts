/**
 * Client-side TikTok Pixel helpers. Imported by client components only.
 *
 * The base pixel loader (events.js + ttq.load() + the initial ttq.page()) is injected
 * once in app/layout.tsx via next/script. These helpers fire individual events and
 * read the _ttp / ttclid identifiers so the server-side Events API can dedup against
 * them.
 *
 * Every event carries an `event_id`; the matching server EAPI call sends the same id
 * and TikTok dedups on (event, event_id). We reuse the very id already generated for
 * the Meta pixel at each firing point (genEventId, or the Stripe session id for the
 * purchase) — event_id is per-vendor, so sharing one string across vendors is
 * harmless. See lib/tiktok-eapi.ts.
 *
 * No-ops gracefully when NEXT_PUBLIC_TIKTOK_PIXEL_ID is unset (pre-bootstrap) — the
 * loader isn't rendered, so window.ttq is undefined and track()/page() return early.
 */

import { CATALOG } from "@/lib/catalog";

export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

type Ttq = {
  track: (...args: unknown[]) => void;
  page: (...args: unknown[]) => void;
  [k: string]: unknown;
};
declare global {
  interface Window {
    ttq?: Ttq;
  }
}

export interface TtContent {
  content_id: string;
  content_type: "product";
  content_name?: string;
  quantity: number;
  price?: number;
}

export interface TtParams {
  contents: TtContent[];
  content_type: "product";
  value: number;
  currency: "USD";
}

/**
 * Build TikTok's `contents` params from product ids. content_name/price are looked up
 * from the catalog; `value` is summed from price × quantity so it matches the cart
 * subtotal. content_id stays the product slug — same value Meta and the feed use.
 */
export function buildContents(
  ids: string[],
  qtyById?: Record<string, number>,
): TtParams {
  const contents: TtContent[] = ids.map((id) => {
    const p = CATALOG[id];
    return {
      content_id: id,
      content_type: "product",
      content_name: p?.name,
      quantity: qtyById?.[id] ?? 1,
      price: p ? p.priceCents / 100 : undefined,
    };
  });
  const value = contents.reduce(
    (sum, c) => sum + (c.price ?? 0) * c.quantity,
    0,
  );
  return { contents, content_type: "product", value, currency: "USD" };
}

/** Fire a standard TikTok Pixel event with an event_id so EAPI can dedup against it. */
export function track(
  event: string,
  params: TtParams | Record<string, unknown>,
  eventId: string,
): void {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track(event, params, { event_id: eventId });
}

/** Fire a TikTok page-view. The loader fires the first one; this covers SPA route changes. */
export function page(): void {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.page();
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** TikTok's first-party browser id cookie — sent raw (never hashed) to EAPI for matching. */
export function getTtp(): string | undefined {
  return readCookie("_ttp");
}

/** TikTok click id: prefer the ?ttclid= URL param, else the ttclid/_ttclid cookie. */
export function getTtclid(): string | undefined {
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("ttclid");
    if (fromUrl) return fromUrl;
  }
  return readCookie("ttclid") ?? readCookie("_ttclid");
}
