/**
 * Meta Conversions API (server-side events). Mirrors the lib/printify.ts pattern:
 * a module-level BASE, lazy env reads, and a sender that throws with the response
 * body on non-2xx. Callers MUST treat failures as non-fatal (try/catch + log) —
 * tracking must never break checkout or fulfillment.
 *
 * Why server-side at all: iOS + ad-blockers drop 20-40% of browser Purchase events.
 * The Stripe webhook is the one place that *knows* a real payment happened, so the
 * authoritative Purchase fires from there. Each event shares an `event_id` with its
 * browser twin; Meta dedups on (event_name, event_id).
 *
 * No-ops when META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are unset (pre-bootstrap).
 */

import { createHash } from "node:crypto";

const GRAPH = process.env.META_GRAPH_BASE || "https://graph.facebook.com/v21.0";

function enabled(): boolean {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** SHA-256 of a trimmed, lowercased value (Meta's normalization for most PII fields). */
function hashField(value?: string): string | undefined {
  const norm = value?.trim().toLowerCase();
  return norm ? sha256(norm) : undefined;
}

/** Phone: strip everything but digits (keep country code), then SHA-256. */
function hashPhone(value?: string): string | undefined {
  const digits = value?.replace(/[^0-9]/g, "");
  return digits ? sha256(digits) : undefined;
}

export interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  /** Sent RAW (not hashed). */
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
}

function buildUserData(u: UserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (k: string, v?: string) => {
    if (v) out[k] = [v];
  };
  set("em", hashField(u.email));
  set("ph", hashPhone(u.phone));
  set("fn", hashField(u.firstName));
  set("ln", hashField(u.lastName));
  set("ct", hashField(u.city));
  set("st", hashField(u.state));
  set("zp", hashField(u.zip));
  set("country", hashField(u.country));
  // Raw identifiers — improve match quality, never hashed.
  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  if (u.clientIp) out.client_ip_address = u.clientIp;
  if (u.userAgent) out.client_user_agent = u.userAgent;
  return out;
}

export interface CustomData {
  currency: "USD";
  value: number;
  content_ids: string[];
  content_type: "product";
  num_items?: number;
}

export interface ServerEvent {
  event_name: "Purchase" | "InitiateCheckout" | "AddToCart" | "ViewContent" | "PageView";
  /** Unix seconds; defaults to now. */
  event_time?: number;
  /** Dedup key — must match the browser event's eventID. */
  event_id: string;
  event_source_url?: string;
  user_data: UserData;
  custom_data?: CustomData;
}

/**
 * Send one or more events to the Conversions API. No-op (resolves) when the pixel
 * isn't configured. Throws with the response body on non-2xx so the caller can log;
 * callers must not let that failure bubble up and break the request.
 */
export async function sendEvents(events: ServerEvent[]): Promise<void> {
  if (!enabled() || events.length === 0) return;

  const pixelId = process.env.META_PIXEL_ID as string;
  const token = process.env.META_CAPI_ACCESS_TOKEN as string;

  const data = events.map((e) => ({
    event_name: e.event_name,
    event_time: e.event_time ?? Math.floor(Date.now() / 1000),
    event_id: e.event_id,
    event_source_url: e.event_source_url,
    action_source: "website" as const,
    user_data: buildUserData(e.user_data),
    custom_data: e.custom_data,
  }));

  const body: Record<string, unknown> = { data };
  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  const res = await fetch(
    `${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Meta CAPI ${res.status}: ${await res.text()}`);
  }
}
