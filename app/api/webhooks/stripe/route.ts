import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createOrder, sendToProduction, type PrintifyItem, type Recipient } from "@/lib/printify";
import { getOrder, recordCreated, markInProduction } from "@/lib/orders-store";
import { sendOrderConfirmationEmail, sendSaleNotification } from "@/lib/email";
import { sendEvents } from "@/lib/meta-capi";
import {
  sendEvents as ttSendEvents,
  contentsFromCatalog,
} from "@/lib/tiktok-eapi";

export const runtime = "nodejs";
// Printify needs ~15-30s of cost-calculation before send_to_production is
// accepted, and we poll for it inline — give the function room beyond the 10s default.
export const maxDuration = 60;

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

  // Idempotency — Stripe retries (and may even retry a request it timed out on
  // while we were still polling). Resume from where we left off; never create a
  // second Printify order for one session.
  let existing: { printifyOrderId: string; status: string } | null;
  try {
    existing = await getOrder(session.id);
  } catch (err) {
    console.error("stripe webhook: order-store lookup failed", err);
    return new Response("store error", { status: 500 });
  }
  // Anything past "created" (in_production / shipped) is already handled.
  // Only a "created" row means "order made but not yet sent to production" -> resume.
  if (existing && existing.status !== "created") {
    return new Response("duplicate", { status: 200 });
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
    // 1) Create the Printify order once, and persist the mapping BEFORE sending to
    //    production. If a retry arrives, we reuse this id instead of re-creating.
    let printifyOrderId = existing?.printifyOrderId;
    if (!printifyOrderId) {
      ({ printifyOrderId } = await createOrder({
        externalId: session.id,
        recipient,
        items,
      }));
      await recordCreated(session.id, printifyOrderId, recipient.email);
    }

    // 2) Send to production (polls until Printify finishes cost-calculation).
    //    If it can't within budget, we throw -> 500 -> Stripe retries -> the
    //    create step is skipped and this resumes (no duplicate order).
    await sendToProduction(printifyOrderId);
    await markInProduction(session.id);

    // Post-order emails. Non-fatal: a send failure must never 500 the webhook
    // (which would re-run fulfillment). Human-readable line-item names aren't in
    // the event, so retrieve them like the /thank-you page does. In offline tests
    // this retrieve throws on the fake session id and the whole block is skipped.
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });
      const items = (full.line_items?.data ?? []).map((li) => ({
        name: li.description ?? "Item",
        quantity: li.quantity ?? 1,
      }));
      const totalCents = full.amount_total ?? session.amount_total ?? 0;
      const buyerEmail = full.customer_details?.email ?? recipient.email;

      // Customer receipt.
      try {
        await sendOrderConfirmationEmail({ to: buyerEmail, items, totalCents });
      } catch (err) {
        console.error("stripe webhook: confirmation email failed (non-fatal)", err);
      }
      // Internal sale alert (always to the owner, every sale).
      try {
        await sendSaleNotification({
          items,
          totalCents,
          buyerEmail,
          shipName: `${recipient.first_name} ${recipient.last_name}`.trim() || undefined,
          shipAddress1: recipient.address1,
          shipAddress2: recipient.address2,
          shipCity: recipient.city,
          shipRegion: recipient.region,
          shipZip: recipient.zip,
          shipCountry: recipient.country,
          shipPhone: recipient.phone,
          printifyOrderId,
        });
      } catch (err) {
        console.error("stripe webhook: sale alert failed (non-fatal)", err);
      }
    } catch (err) {
      console.error("stripe webhook: post-order emails skipped (non-fatal)", err);
    }

    // Authoritative server-side Purchase for Meta — fired AFTER markInProduction so
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

    // Authoritative server-side TikTok CompletePayment. Shares its event_id (the
    // session id) with the browser CompletePayment on the thank-you page so TikTok
    // dedups them. Non-fatal, same as the Meta block above.
    try {
      const md = session.metadata ?? {};
      let contentIds: string[] = [];
      try {
        const parsed = JSON.parse(md.meta_content_ids || "[]");
        if (Array.isArray(parsed)) contentIds = parsed;
      } catch {
        /* ignore malformed metadata */
      }
      await ttSendEvents([
        {
          event: "CompletePayment",
          event_id: session.id,
          event_source_url: `${process.env.SITE_URL ?? ""}/thank-you`,
          user_data: {
            email: session.customer_details?.email ?? undefined,
            phone: session.customer_details?.phone ?? undefined,
            ttp: md.tt_ttp || undefined,
            ttclid: md.tt_ttclid || undefined,
          },
          custom_data: {
            currency: "USD",
            value: (session.amount_total ?? 0) / 100,
            contents: contentsFromCatalog(contentIds),
            content_type: "product",
          },
        },
      ]);
    } catch (err) {
      console.error("stripe webhook: TikTok EAPI CompletePayment failed (non-fatal)", err);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    // Transient failure (Printify outage / Wallet) -> 500 so Stripe retries.
    console.error("stripe webhook: printify order failed", err);
    return new Response("printify error", { status: 500 });
  }
}
