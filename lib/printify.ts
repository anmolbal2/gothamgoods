/**
 * Printify integration. Two steps to actually start fulfillment:
 *   1) create the order
 *   2) send it to production  <-- without this, nothing ships
 *
 * Base URL is overridable via PRINTIFY_API_BASE so tests can point at a mock.
 */

const BASE = process.env.PRINTIFY_API_BASE || "https://api.printify.com/v1";

export interface Recipient {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  country?: string;
  region?: string;
  address1?: string;
  address2?: string;
  city?: string;
  zip?: string;
}

export interface PrintifyItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.PRINTIFY_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
  };
}

function shop() {
  const id = process.env.PRINTIFY_SHOP_ID;
  if (!id) throw new Error("PRINTIFY_SHOP_ID is not set");
  return id;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Printify ${res.status} for ${url}: ${text}`);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/**
 * Create a Printify order AND send it to production (auto-fulfillment).
 * Returns the new Printify order id. Throws (with the response body) on any
 * non-2xx so the Stripe webhook can return 500 and let Stripe retry.
 */
export async function createConfirmedOrder(args: {
  externalId: string;
  recipient: Recipient;
  items: PrintifyItem[];
}): Promise<{ printifyOrderId: string }> {
  const { externalId, recipient, items } = args;
  const shopId = shop();

  const created = await postJson(`${BASE}/shops/${shopId}/orders.json`, {
    external_id: externalId,
    line_items: items,
    shipping_method: 1,
    send_shipping_notification: false,
    address_to: recipient,
  });

  const printifyOrderId = String(created.id ?? "");
  if (!printifyOrderId) {
    throw new Error(`Printify order create returned no id: ${JSON.stringify(created)}`);
  }

  await postJson(
    `${BASE}/shops/${shopId}/orders/${printifyOrderId}/send_to_production.json`,
    {},
  );

  return { printifyOrderId };
}
