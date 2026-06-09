import { test, expect, type APIRequestContext } from "@playwright/test";
import { buildCheckoutCompleted, signEvent } from "./fixtures";

const MOCK = "http://localhost:4010";

let counter = 0;
const uniqueSessionId = () => `cs_test_${Date.now()}_${counter++}`;

async function resetMock(request: APIRequestContext) {
  await request.post(`${MOCK}/__reset`);
}
async function mockCalls(request: APIRequestContext) {
  const res = await request.get(`${MOCK}/__calls`);
  const { calls } = await res.json();
  return calls as Array<{ type: string; body?: Record<string, unknown> }>;
}

function post(request: APIRequestContext, payload: string, header: string) {
  return request.post("/api/webhooks/stripe", {
    headers: { "stripe-signature": header, "content-type": "application/json" },
    data: payload,
  });
}

test.describe("Stripe webhook -> Printify (Layer B, offline)", () => {
  test.beforeEach(async ({ request }) => {
    await resetMock(request);
  });

  test("valid signed event -> 200 and exactly one create + one send_to_production", async ({
    request,
  }) => {
    const event = buildCheckoutCompleted({ sessionId: uniqueSessionId() });
    const { payload, header } = signEvent(event);

    const res = await post(request, payload, header);
    expect(res.status()).toBe(200);

    const calls = await mockCalls(request);
    expect(calls.filter((c) => c.type === "create").length).toBe(1);
    expect(calls.filter((c) => c.type === "send_to_production").length).toBe(1);
  });

  test("replaying the same session id -> 200 'duplicate' and no second order", async ({
    request,
  }) => {
    const sessionId = uniqueSessionId();
    const { payload, header } = signEvent(buildCheckoutCompleted({ sessionId }));

    const first = await post(request, payload, header);
    expect(first.status()).toBe(200);

    const second = await post(request, payload, header);
    expect(second.status()).toBe(200);
    expect((await second.text()).toLowerCase()).toContain("duplicate");

    const calls = await mockCalls(request);
    expect(calls.filter((c) => c.type === "create").length).toBe(1); // unchanged
  });

  test("tampered/garbage signature -> 400 and no Printify call", async ({ request }) => {
    const event = buildCheckoutCompleted({ sessionId: uniqueSessionId() });
    const payload = JSON.stringify(event);

    const res = await post(request, payload, "t=1,v1=deadbeefdeadbeef");
    expect(res.status()).toBe(400);

    const calls = await mockCalls(request);
    expect(calls.length).toBe(0);
  });

  test("Printify failure -> 500 so Stripe retries", async ({ request }) => {
    await request.post(`${MOCK}/__fail`, { data: { fail: true } });

    const { payload, header } = signEvent(
      buildCheckoutCompleted({ sessionId: uniqueSessionId() }),
    );
    const res = await post(request, payload, header);
    expect(res.status()).toBe(500);
  });

  test("maps the shipping address correctly into the Printify order", async ({
    request,
  }) => {
    const event = buildCheckoutCompleted({
      sessionId: uniqueSessionId(),
      shipping: {
        name: "John Q Public",
        line1: "20 W 34th St",
        city: "New York",
        state: "NY",
        postal_code: "10001",
        country: "US",
      },
      customer: {
        name: "John Q Public",
        email: "john@example.com",
        phone: "+12125550100",
      },
      printifyItems: [{ product_id: "PID_ABC", variant_id: 4242, quantity: 2 }],
    });
    const { payload, header } = signEvent(event);

    const res = await post(request, payload, header);
    expect(res.status()).toBe(200);

    const calls = await mockCalls(request);
    const create = calls.find((c) => c.type === "create");
    expect(create).toBeTruthy();

    const body = create!.body as {
      external_id: string;
      address_to: Record<string, string>;
      line_items: Array<{ product_id: string; variant_id: number; quantity: number }>;
      shipping_method: number;
      send_shipping_notification: boolean;
    };

    expect(body.address_to.first_name).toBe("John");
    expect(body.address_to.last_name).toBe("Q Public");
    expect(body.address_to.region).toBe("NY");
    expect(body.address_to.zip).toBe("10001");
    expect(body.address_to.country).toBe("US");
    expect(body.address_to.email).toBe("john@example.com");
    expect(body.line_items[0]).toEqual({
      product_id: "PID_ABC",
      variant_id: 4242,
      quantity: 2,
    });
    expect(body.shipping_method).toBe(1);
    expect(body.send_shipping_notification).toBe(false);
  });

  test("malformed printify_items metadata -> 200 and no Printify call", async ({
    request,
  }) => {
    const event = buildCheckoutCompleted({
      sessionId: uniqueSessionId(),
      metadataOverride: { printify_items: "not-json{" },
    });
    const { payload, header } = signEvent(event);

    const res = await post(request, payload, header);
    expect(res.status()).toBe(200);

    const calls = await mockCalls(request);
    expect(calls.length).toBe(0);
  });
});
