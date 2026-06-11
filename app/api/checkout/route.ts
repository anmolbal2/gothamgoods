import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { resolveLine, type Size } from "@/lib/catalog";
import { SALE } from "@/lib/sale";
import type { PrintifyItem } from "@/lib/printify";
import { sendEvents } from "@/lib/meta-capi";
import {
  sendEvents as ttSendEvents,
  contentsFromCatalog,
} from "@/lib/tiktok-eapi";

export const runtime = "nodejs";

interface CartLine {
  productId: string;
  colorName: string;
  size: Size;
  qty: number;
}

/**
 * POST { cart: [{ productId, colorName, size, qty }], eventId?, fbp?, fbc? }
 * Prices everything server-side from the catalog — the browser's prices are ignored.
 * Returns { url } of the Stripe Checkout session to redirect to.
 *
 * The Meta fields (eventId/fbp/fbc) are stashed into session metadata so the Stripe
 * webhook can fire the authoritative server-side Purchase, and a server-side
 * InitiateCheckout fires here (deduped against the browser one via eventId).
 */
export async function POST(request: Request) {
  let body: {
    cart?: CartLine[];
    eventId?: string;
    fbp?: string;
    fbc?: string;
    ttp?: string;
    ttclid?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cart = body?.cart;
  if (!Array.isArray(cart) || cart.length === 0) {
    return Response.json({ error: "Cart is empty" }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const printify_items: PrintifyItem[] = [];
  const contentIds = new Set<string>();
  const qtyByProduct: Record<string, number> = {};
  let totalCents = 0;
  let totalQty = 0;

  try {
    for (const { productId, colorName, size, qty } of cart) {
      const { name, priceCents, item } = resolveLine(productId, colorName, size);
      const quantity = Math.min(10, Math.max(1, Math.floor(Number(qty) || 1)));
      line_items.push({
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          // The sale note renders under the line item on the Stripe page. It is a
          // PRODUCT description — Stripe line_items[].description (used by our
          // receipts as the item name) still resolves to the product name.
          product_data: {
            name,
            ...(SALE.active ? { description: SALE.stripeNote } : {}),
          },
        },
        quantity,
      });
      printify_items.push({ ...item, quantity });
      contentIds.add(productId);
      qtyByProduct[productId] = (qtyByProduct[productId] ?? 0) + quantity;
      totalCents += priceCents * quantity;
      totalQty += quantity;
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid cart" },
      { status: 400 },
    );
  }

  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const ids = [...contentIds];
  const eventId = typeof body.eventId === "string" ? body.eventId : undefined;
  const fbp = typeof body.fbp === "string" ? body.fbp : "";
  const fbc = typeof body.fbc === "string" ? body.fbc : "";
  const ttp = typeof body.ttp === "string" ? body.ttp : "";
  const ttclid = typeof body.ttclid === "string" ? body.ttclid : "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: ["US"] },
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: 0, currency: "usd" },
            display_name: "Free Shipping — ships from NJ in 2-3 days",
          },
        },
      ],
      // Stash the Printify line items so the webhook can place the order, plus the
      // Meta identifiers so the webhook can fire the server-side Purchase.
      metadata: {
        printify_items: JSON.stringify(printify_items),
        meta_fbp: fbp,
        meta_fbc: fbc,
        meta_content_ids: JSON.stringify(ids),
        meta_num_items: String(totalQty),
        tt_ttp: ttp,
        tt_ttclid: ttclid,
      },
      success_url: `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
    });

    // Server-side InitiateCheckout (deduped against the browser event via eventId).
    // Non-fatal: a CAPI hiccup must never block the redirect to Stripe.
    if (eventId) {
      try {
        await sendEvents([
          {
            event_name: "InitiateCheckout",
            event_id: eventId,
            event_source_url: `${siteUrl}/`,
            user_data: {
              fbp: fbp || undefined,
              fbc: fbc || undefined,
              clientIp:
                request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                undefined,
              userAgent: request.headers.get("user-agent") || undefined,
            },
            custom_data: {
              currency: "USD",
              value: totalCents / 100,
              content_ids: ids,
              content_type: "product",
              num_items: totalQty,
            },
          },
        ]);
      } catch (err) {
        console.error("checkout: CAPI InitiateCheckout failed (non-fatal)", err);
      }

      // Server-side TikTok InitiateCheckout (deduped against the browser event via
      // eventId). Non-fatal, same as Meta above.
      try {
        await ttSendEvents([
          {
            event: "InitiateCheckout",
            event_id: eventId,
            event_source_url: `${siteUrl}/`,
            user_data: {
              ttp: ttp || undefined,
              ttclid: ttclid || undefined,
              clientIp:
                request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
                undefined,
              userAgent: request.headers.get("user-agent") || undefined,
            },
            custom_data: {
              currency: "USD",
              value: totalCents / 100,
              contents: contentsFromCatalog(ids, qtyByProduct),
              content_type: "product",
            },
          },
        ]);
      } catch (err) {
        console.error("checkout: TikTok EAPI InitiateCheckout failed (non-fatal)", err);
      }
    }

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("checkout: failed to create session", err);
    return Response.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
