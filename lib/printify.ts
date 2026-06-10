/**
 * Printify integration. Fulfillment is two steps:
 *   1) create the order
 *   2) send it to production  <-- without this, nothing ships
 *
 * IMPORTANT TIMING: a freshly created order spends ~15-30s in "cost-calculation"
 * before Printify will accept send_to_production (it 400s otherwise). So
 * sendToProduction() polls until the order is ready ("on-hold") and is safe to
 * retry — it's a no-op once an order is already in/past production.
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function getOrderStatus(shopId: string, orderId: string): Promise<string> {
  const res = await fetch(`${BASE}/shops/${shopId}/orders/${orderId}.json`, {
    headers: authHeaders(),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Printify GET order ${res.status}: ${text}`);
  try {
    return String((text ? JSON.parse(text) : {}).status ?? "");
  } catch {
    return "";
  }
}

/** Create a Printify order (does NOT send to production). Returns the new order id. */
export async function createOrder(args: {
  externalId: string;
  recipient: Recipient;
  items: PrintifyItem[];
}): Promise<{ printifyOrderId: string }> {
  const { externalId, recipient, items } = args;
  const created = await postJson(`${BASE}/shops/${shop()}/orders.json`, {
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
  return { printifyOrderId };
}

// Order isn't ready for production yet — keep polling.
const WAITING = new Set(["", "pending", "cost-calculation"]);

/**
 * Send an order to production once Printify finishes cost-calculation.
 * - Polls the order status until it's "on-hold" (ready), then sends.
 * - Idempotent: if the order is already in/past production, it returns without
 *   re-sending. Throws on a canceled order, or if it never becomes ready within
 *   the polling budget (caller should 500 so Stripe retries — by then it's ready).
 */
export async function sendToProduction(
  printifyOrderId: string,
  { attempts = 14, delayMs = 2500 }: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  const shopId = shop();
  for (let i = 0; i < attempts; i++) {
    const status = await getOrderStatus(shopId, printifyOrderId);
    if (status === "on-hold") {
      await postJson(
        `${BASE}/shops/${shopId}/orders/${printifyOrderId}/send_to_production.json`,
        {},
      );
      return;
    }
    if (status === "canceled") {
      throw new Error(`Printify order ${printifyOrderId} is canceled — cannot fulfill`);
    }
    if (!WAITING.has(status)) return; // already sending/in-production/fulfilled — nothing to do
    await sleep(delayMs);
  }
  throw new Error(
    `Printify order ${printifyOrderId} not ready for production after ${attempts} polls`,
  );
}
