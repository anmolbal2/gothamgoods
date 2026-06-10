/**
 * TikTok Events API (server-side events). Mirrors lib/meta-capi.ts: a module-level
 * BASE, lazy env reads, and a sender that throws on failure. Callers MUST treat
 * failures as non-fatal (try/catch + log) — tracking must never break checkout or
 * fulfillment.
 *
 * Why server-side at all: iOS + ad-blockers drop 20-40% of browser events. The Stripe
 * webhook is the one place that *knows* a real payment happened, so the authoritative
 * CompletePayment fires from there. Each event shares an `event_id` with its browser
 * twin; TikTok dedups on (event, event_id).
 *
 * Two TikTok-specific gotchas vs Meta:
 *  - The phone number is hashed in E.164 form *keeping the leading `+`* (Meta strips it).
 *  - TikTok returns HTTP 200 even on logical errors, with a non-zero `code` in the body,
 *    so we inspect the JSON `code` after res.ok.
 *
 * No-ops when TIKTOK_PIXEL_ID / TIKTOK_EAPI_ACCESS_TOKEN are unset (pre-bootstrap).
 */

import { createHash } from "node:crypto";
import { CATALOG } from "@/lib/catalog";

const BASE =
  process.env.TIKTOK_EAPI_BASE || "https://business-api.tiktok.com/open_api/v1.3";

function enabled(): boolean {
  return Boolean(process.env.TIKTOK_PIXEL_ID && process.env.TIKTOK_EAPI_ACCESS_TOKEN);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** SHA-256 of a trimmed, lowercased value (TikTok's normalization for email / name fields). */
function hashField(value?: string): string | undefined {
  const norm = value?.trim().toLowerCase();
  return norm ? sha256(norm) : undefined;
}

/** Phone: normalize to E.164 (keep the leading `+` and digits), then SHA-256. */
function hashPhone(value?: string): string | undefined {
  const norm = value?.replace(/[^0-9+]/g, "");
  return norm ? sha256(norm) : undefined;
}

export interface TtUserData {
  email?: string;
  phone?: string;
  externalId?: string;
  /** Sent RAW (not hashed). */
  ttp?: string;
  ttclid?: string;
  clientIp?: string;
  userAgent?: string;
}

function buildUser(u: TtUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const email = hashField(u.email);
  const phone = hashPhone(u.phone);
  const externalId = hashField(u.externalId);
  if (email) out.email = email;
  if (phone) out.phone = phone; // v1.3 user field is `phone` (legacy v1.2 used `phone_number`)
  if (externalId) out.external_id = externalId;
  // Raw identifiers — improve match quality, never hashed.
  if (u.ttp) out.ttp = u.ttp;
  if (u.ttclid) out.ttclid = u.ttclid;
  if (u.clientIp) out.ip = u.clientIp;
  if (u.userAgent) out.user_agent = u.userAgent;
  return out;
}

export interface TtContent {
  content_id: string;
  content_type: "product";
  content_name?: string;
  quantity: number;
  price?: number;
}

export interface TtCustomData {
  currency: "USD";
  value: number;
  contents: TtContent[];
  content_type: "product";
}

/** Build the `contents` array from product slugs, pulling name/price from the catalog. */
export function contentsFromCatalog(
  ids: string[],
  qtyById?: Record<string, number>,
): TtContent[] {
  return ids.map((id) => {
    const p = CATALOG[id];
    return {
      content_id: id,
      content_type: "product",
      content_name: p?.name,
      quantity: qtyById?.[id] ?? 1,
      price: p ? p.priceCents / 100 : undefined,
    };
  });
}

export interface TtServerEvent {
  event: "CompletePayment" | "InitiateCheckout" | "AddToCart" | "ViewContent";
  /** Unix seconds; defaults to now. */
  event_time?: number;
  /** Dedup key — must match the browser event's event_id. */
  event_id: string;
  event_source_url?: string;
  user_data: TtUserData;
  custom_data?: TtCustomData;
}

/**
 * Send one or more events to the TikTok Events API. No-op (resolves) when the pixel
 * isn't configured. Throws on transport failure OR a non-zero response `code` so the
 * caller can log; callers must not let that failure bubble up and break the request.
 */
export async function sendEvents(events: TtServerEvent[]): Promise<void> {
  if (!enabled() || events.length === 0) return;

  const pixelCode = process.env.TIKTOK_PIXEL_ID as string;
  const token = process.env.TIKTOK_EAPI_ACCESS_TOKEN as string;

  const data = events.map((e) => ({
    event: e.event,
    event_time: e.event_time ?? Math.floor(Date.now() / 1000),
    event_id: e.event_id,
    user: buildUser(e.user_data),
    properties: e.custom_data,
    ...(e.event_source_url ? { page: { url: e.event_source_url } } : {}),
  }));

  const body: Record<string, unknown> = {
    event_source: "web",
    event_source_id: pixelCode,
    data,
  };
  if (process.env.TIKTOK_TEST_EVENT_CODE) {
    body.test_event_code = process.env.TIKTOK_TEST_EVENT_CODE;
  }

  const res = await fetch(`${BASE}/event/track/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": token },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`TikTok EAPI ${res.status}: ${await res.text()}`);
  }

  // TikTok answers 200 even on logical errors — success is code === 0.
  const json = (await res.json().catch(() => ({}))) as {
    code?: number;
    message?: string;
  };
  if (typeof json.code === "number" && json.code !== 0) {
    throw new Error(`TikTok EAPI code ${json.code}: ${json.message ?? "unknown"}`);
  }
}
