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

/** True if this Stripe session has already produced a Printify order (idempotency). */
export async function alreadyProcessed(sessionId: string): Promise<boolean> {
  if (useSupabase) {
    const { data, error } = await supabase()
      .from("orders")
      .select("session_id")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error(`Supabase alreadyProcessed: ${error.message}`);
    return Boolean(data);
  }
  return mem.has(sessionId);
}

/** Record that a session was fulfilled. Safe to rely on the session_id unique constraint. */
export async function markProcessed(
  sessionId: string,
  orderId: string,
  email?: string,
): Promise<void> {
  if (useSupabase) {
    const { error } = await supabase()
      .from("orders")
      .insert({
        session_id: sessionId,
        printify_order_id: orderId,
        email,
        status: "created",
      });
    if (error) throw new Error(`Supabase markProcessed: ${error.message}`);
    return;
  }
  mem.set(sessionId, { orderId, email });
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
