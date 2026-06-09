import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { resolveLine, type Size } from "@/lib/catalog";
import type { PrintifyItem } from "@/lib/printify";

export const runtime = "nodejs";

interface CartLine {
  productId: string;
  colorName: string;
  size: Size;
  qty: number;
}

/**
 * POST { cart: [{ productId, size, qty }] }
 * Prices everything server-side from the catalog — the browser's prices are ignored.
 * Returns { url } of the Stripe Checkout session to redirect to.
 */
export async function POST(request: Request) {
  let body: { cart?: CartLine[] };
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

  try {
    for (const { productId, colorName, size, qty } of cart) {
      const { name, priceCents, item } = resolveLine(productId, colorName, size);
      const quantity = Math.min(10, Math.max(1, Math.floor(Number(qty) || 1)));
      line_items.push({
        price_data: {
          currency: "usd",
          unit_amount: priceCents,
          product_data: { name },
        },
        quantity,
      });
      printify_items.push({ ...item, quantity });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid cart" },
      { status: 400 },
    );
  }

  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

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
      // Stash the Printify line items so the webhook can place the order.
      metadata: { printify_items: JSON.stringify(printify_items) },
      success_url: `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("checkout: failed to create session", err);
    return Response.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
