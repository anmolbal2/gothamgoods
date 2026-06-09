/**
 * Client-side Meta Pixel helpers. Imported by client components only.
 *
 * The base pixel loader (fbevents.js + fbq('init') + initial PageView) is injected
 * once in app/layout.tsx via next/script. These helpers fire individual events and
 * read the fbp/fbc cookies so the server-side Conversions API can dedup against them.
 *
 * Every event carries an `eventId`; the matching server CAPI call sends the same id
 * and Meta dedups on (event_name, event_id). See lib/meta-capi.ts.
 *
 * No-ops gracefully when NEXT_PUBLIC_META_PIXEL_ID is unset (pre-bootstrap) — the
 * loader isn't rendered, so window.fbq is undefined and track() returns early.
 */

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = (...args: unknown[]) => void;
declare global {
  interface Window {
    fbq?: Fbq;
  }
}

/** Unique id shared between a browser event and its server CAPI twin (the dedup key). */
export function genEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export interface ContentParams {
  content_ids: string[];
  content_type: "product";
  value?: number;
  currency?: "USD";
  num_items?: number;
}

/** Fire a standard Pixel event with an eventID so CAPI can dedup against it. */
export function track(
  event: string,
  params: ContentParams | Record<string, unknown>,
  eventId: string,
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", event, params, { eventID: eventId });
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Meta's browser id cookie — sent raw (never hashed) to CAPI for matching. */
export function getFbp(): string | undefined {
  return readCookie("_fbp");
}

/** Meta's click id cookie; if absent, derive it from a ?fbclid= in the URL (fb.1.<ts>.<id>). */
export function getFbc(): string | undefined {
  const existing = readCookie("_fbc");
  if (existing) return existing;
  if (typeof window === "undefined") return undefined;
  const fbclid = new URLSearchParams(window.location.search).get("fbclid");
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined;
}
