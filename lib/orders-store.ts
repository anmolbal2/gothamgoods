/**
 * Order persistence with two backends behind one async API:
 *   - Supabase  (when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set)
 *   - in-memory Map  (otherwise — for local dev and offline tests)
 *
 * IMPORTANT: the in-memory Map is per-process and ephemeral. On serverless
 * (Vercel) each instance has its own memory, so idempotency and tracking break
 * across instances. **Supabase is required in production.**
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

interface OrderRecord {
  orderId: string;
  email?: string;
  status?: string;
  trackingNumber?: string;
  trackingUrl?: string;
}

// Singleton Map survives `next dev` requests and HMR by hanging off globalThis.
const mem: Map<string, OrderRecord> =
  ((globalThis as unknown as { __gothamOrders?: Map<string, OrderRecord> })
    .__gothamOrders ??= new Map());

let _supabase: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

export interface SessionOrder {
  printifyOrderId: string;
  status: string;
}

/**
 * Look up the Printify order already created for this Stripe session, if any.
 * Drives idempotency: the webhook creates the Printify order exactly once and
 * persists the mapping here BEFORE sending to production, so a Stripe retry
 * resumes (sends to production) instead of creating a duplicate order.
 */
export async function getOrder(sessionId: string): Promise<SessionOrder | null> {
  if (useSupabase) {
    const { data, error } = await supabase()
      .from("orders")
      .select("printify_order_id,status")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error(`Supabase getOrder: ${error.message}`);
    return data
      ? { printifyOrderId: data.printify_order_id, status: data.status ?? "created" }
      : null;
  }
  const rec = mem.get(sessionId);
  return rec ? { printifyOrderId: rec.orderId, status: rec.status ?? "created" } : null;
}

/**
 * Record that a Printify order was created for this session (status "created").
 * Idempotent: a concurrent insert hitting the session_id unique constraint is
 * treated as success (the row already exists).
 */
export async function recordCreated(
  sessionId: string,
  orderId: string,
  email?: string,
): Promise<void> {
  if (useSupabase) {
    const { error } = await supabase()
      .from("orders")
      .insert({ session_id: sessionId, printify_order_id: orderId, email, status: "created" });
    // 23505 = unique_violation: another delivery already recorded this session.
    if (error && error.code !== "23505") {
      throw new Error(`Supabase recordCreated: ${error.message}`);
    }
    return;
  }
  if (!mem.has(sessionId)) mem.set(sessionId, { orderId, email, status: "created" });
}

/** Mark a session's order as sent to production (terminal for the webhook). */
export async function markInProduction(sessionId: string): Promise<void> {
  if (useSupabase) {
    const { error } = await supabase()
      .from("orders")
      .update({ status: "in_production", updated_at: new Date().toISOString() })
      .eq("session_id", sessionId);
    if (error) throw new Error(`Supabase markInProduction: ${error.message}`);
    return;
  }
  const rec = mem.get(sessionId);
  if (rec) rec.status = "in_production";
}

/** Attach tracking info to an order (looked up by Printify order id). */
export async function attachTracking(
  orderId: string,
  trackingNumber?: string,
  trackingUrl?: string,
): Promise<void> {
  if (useSupabase) {
    const { error } = await supabase()
      .from("orders")
      .update({
        tracking_number: trackingNumber,
        tracking_url: trackingUrl,
        status: "shipped",
        updated_at: new Date().toISOString(),
      })
      .eq("printify_order_id", orderId);
    if (error) throw new Error(`Supabase attachTracking: ${error.message}`);
    return;
  }
  for (const record of mem.values()) {
    if (record.orderId === orderId) {
      record.trackingNumber = trackingNumber;
      record.trackingUrl = trackingUrl;
    }
  }
}

/** Look up the buyer email for an order (used by the Printify shipment webhook). */
export async function getEmailForOrder(orderId: string): Promise<string | undefined> {
  if (useSupabase) {
    const { data } = await supabase()
      .from("orders")
      .select("email")
      .eq("printify_order_id", orderId)
      .maybeSingle();
    return data?.email ?? undefined;
  }
  for (const record of mem.values()) {
    if (record.orderId === orderId) return record.email;
  }
  return undefined;
}
