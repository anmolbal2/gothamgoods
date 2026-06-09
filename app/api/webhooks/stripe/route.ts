import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createConfirmedOrder, type PrintifyItem, type Recipient } from "@/lib/printify";
import { alreadyProcessed, markProcessed } from "@/lib/orders-store";
import { sendEvents } from "@/lib/meta-capi";

export const runtime = "nodejs";

// The deprecated `shipping_details` and newer `collected_information.shipping_details`
// are not both present in every SDK's typings, so we read through a loose shape.
interface AddressLike {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}
interface ShippingLike {
  name?: string | null;
  address?: AddressLike | null;
}
interface SessionLike {
  id: string;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
  customer_details?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  collected_information?: { shipping_details?: ShippingLike | null } | null;
  shipping_details?: ShippingLike | null;
}

function buildRecipient(session: SessionLike): Recipient {
  // Stripe moved the shipping address into collected_information (Mar 2025);
  // fall back to the deprecated top-level field for older API versions.
  const ship =
    session.collected_information?.shipping_details ??
    session.shipping_details ??
    undefined;
  const cust = session.customer_details ?? undefined;
  const addr = ship?.address ?? undefined;

  const fullName = (ship?.name ?? cust?.name ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const first_name = parts[0] ?? "";
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : "";

  return {
    first_name,
    last_name,
    email: cust?.email ?? undefined,
    phone: cust?.phone ?? undefined,
    country: addr?.country ?? undefined,
    region: addr?.state ?? undefined,
    address1: addr?.line1 ?? undefined,
    address2: addr?.line2 ?? undefined,
    city: addr?.city ?? undefined,
    zip: addr?.postal_code ?? undefined,
  };
}

export async function POST(request: Request) {
  const raw = await request.text(); // RAW body — required for signature verification
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? "", secret ?? "");
  } catch (err) {
    console.error(
      "stripe webhook: signature verification failed",
      err instanceof Error ? err.message : err,
    );
    return new Response("bad signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as unknown as SessionLike;

  // Idempotency — Stripe retries; never create two Printify orders for one session.
  try {
    if (await alreadyProcessed(session.id)) {
      return new Response("duplicate", { status: 200 });
    }
  } catch (err) {
    console.error("stripe webhook: order-store lookup failed", err);
    return new Response("store error", { status: 500 });
  }

  // Parse the Printify items stashed at checkout time.
  let items: PrintifyItem[];
  try {
    const json = session.metadata?.printify_items;
    if (!json) throw new Error("missing metadata.printify_items");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("empty printify_items");
    }
    items = parsed;
  } catch (err) {
    // Permanently broken event -> 200 so Stripe stops retrying.
    console.error("stripe webhook: bad printify_items metadata", err);
    return new Response("bad metadata", { status: 200 });
  }

  const recipient = buildRecipient(session);

  try {
    const { printifyOrderId } = await createConfirmedOrder({
      externalId: session.id,
      recipient,
      items,
    });
    await markProcessed(session.id, printifyOrderId, recipient.email);

    // Authoritative server-side Purchase for Meta — fired AFTER markProcessed so
    // Stripe retries can't double-count, and shares its event_id (the session id)
    // with the browser Purchase on the thank-you page so Meta dedups them.
    // Non-fatal: a CAPI failure must never make this webhook 500 (which would
    // re-run fulfillment), so we only log it.
    try {
      const md = session.metadata ?? {};
      let contentIds: string[] = [];
      try {
        const parsed = JSON.parse(md.meta_content_ids || "[]");
        if (Array.isArray(parsed)) contentIds = parsed;
      } catch {
        /* ignore malformed metadata */
      }
      const numItems =
        Number(md.meta_num_items) ||
        items.reduce((sum, it) => sum + it.quantity, 0);
      await sendEvents([
        {
          event_name: "Purchase",
          event_id: session.id,
          event_source_url: `${process.env.SITE_URL ?? ""}/thank-you`,
          user_data: {
            email: session.customer_details?.email ?? undefined,
            phone: session.customer_details?.phone ?? undefined,
            firstName: recipient.first_name || undefined,
            lastName: recipient.last_name || undefined,
            city: recipient.city,
            state: recipient.region,
            zip: recipient.zip,
            country: recipient.country,
            fbp: md.meta_fbp || undefined,
            fbc: md.meta_fbc || undefined,
          },
          custom_data: {
            currency: "USD",
            value: (session.amount_total ?? 0) / 100,
            content_ids: contentIds,
            content_type: "product",
            num_items: numItems,
          },
        },
      ]);
    } catch (err) {
      console.error("stripe webhook: CAPI Purchase failed (non-fatal)", err);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    // Transient failure (Printify outage / Wallet) -> 500 so Stripe retries.
    console.error("stripe webhook: printify order failed", err);
    return new Response("printify error", { status: 500 });
  }
}
