import Stripe from "stripe";

// Key value is irrelevant — generateTestHeaderString computes a local HMAC.
const stripe = new Stripe("sk_test_dummy_for_signing");

export interface BuildOpts {
  sessionId?: string;
  printifyItems?: Array<{ product_id: string; variant_id: number; quantity: number }>;
  shipping?: {
    name?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  customer?: { name?: string; email?: string; phone?: string };
  /** Replace metadata entirely (e.g. to inject malformed printify_items). */
  metadataOverride?: Record<string, string>;
  /** Catalog slugs stashed as meta_content_ids (the Pixel/EAPI content_ids). */
  contentIds?: string[];
  /** Order total in cents (becomes session.amount_total). */
  amountTotal?: number;
  /** TikTok identifiers stashed at checkout time. */
  ttp?: string;
  ttclid?: string;
}

/** Build a fake Stripe `checkout.session.completed` event object. */
export function buildCheckoutCompleted(opts: BuildOpts = {}) {
  const sessionId = opts.sessionId ?? `cs_test_${Math.random().toString(36).slice(2)}`;

  const shipping = {
    name: "Jane Doe",
    line1: "1 Main St",
    line2: "Apt 4",
    city: "Newark",
    state: "NJ",
    postal_code: "07101",
    country: "US",
    ...opts.shipping,
  };
  const customer = {
    name: "Jane Doe",
    email: "jane@example.com",
    phone: "+15551234567",
    ...opts.customer,
  };
  const printifyItems = opts.printifyItems ?? [
    { product_id: "PLACEHOLDER_KNICKS", variant_id: 1002, quantity: 1 },
  ];
  const contentIds = opts.contentIds ?? ["knicks-in-four"];
  const amountTotal = opts.amountTotal ?? 4999;
  const metadata =
    opts.metadataOverride ?? {
      printify_items: JSON.stringify(printifyItems),
      meta_content_ids: JSON.stringify(contentIds),
      meta_num_items: String(
        printifyItems.reduce((sum, it) => sum + it.quantity, 0),
      ),
      tt_ttp: opts.ttp ?? "tt.p.mock",
      tt_ttclid: opts.ttclid ?? "tt.clid.mock",
    };

  return {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        amount_total: amountTotal,
        metadata,
        customer_details: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        collected_information: {
          shipping_details: {
            name: shipping.name,
            address: {
              line1: shipping.line1,
              line2: shipping.line2,
              city: shipping.city,
              state: shipping.state,
              postal_code: shipping.postal_code,
              country: shipping.country,
            },
          },
        },
      },
    },
  };
}

/**
 * Sign an event payload exactly like Stripe would. Returns the raw payload string
 * (which MUST be the request body, byte-for-byte) and the Stripe-Signature header.
 */
export function signEvent(
  event: unknown,
  secret: string = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_testsecret123",
) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}
