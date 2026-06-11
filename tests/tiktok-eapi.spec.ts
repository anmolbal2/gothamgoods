import { test, expect, type APIRequestContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { buildCheckoutCompleted, signEvent } from "./fixtures";
import { listProducts } from "../lib/catalog";

/**
 * Offline proof of the server-side TikTok Events API leg: a signed
 * checkout.session.completed drives the Stripe webhook (local HMAC, no live Stripe),
 * and we assert against the mock TikTok Events API (tests/mock-tiktok.mjs on :4011)
 * that the authoritative CompletePayment was sent with the right dedup id, hashed
 * PII, and payload shape — and that an EAPI failure never breaks fulfillment.
 */

const TT_MOCK = "http://localhost:4011";
const PF_MOCK = "http://localhost:4010";

const product = listProducts()[0];
const SLUG = product.id;
const PRICE = product.priceCents;

let counter = 0;
const uniqueSessionId = () => `cs_test_tt_${Date.now()}_${counter++}`;
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

interface TtCall {
  type: string;
  accessToken?: string;
  body?: {
    event_source?: string;
    event_source_id?: string;
    data?: Array<{
      event: string;
      event_id: string;
      user: Record<string, string>;
      properties: {
        value: number;
        currency: string;
        contents: Array<{ content_id: string; price?: number }>;
        content_type: string;
      };
    }>;
  };
}

async function resetMocks(request: APIRequestContext) {
  await request.post(`${TT_MOCK}/__reset`);
  await request.post(`${PF_MOCK}/__reset`);
}
async function ttCalls(request: APIRequestContext): Promise<TtCall[]> {
  const { calls } = await (await request.get(`${TT_MOCK}/__calls`)).json();
  return calls;
}
async function pfCalls(request: APIRequestContext) {
  const { calls } = await (await request.get(`${PF_MOCK}/__calls`)).json();
  return calls as Array<{ type: string }>;
}
function postWebhook(request: APIRequestContext, payload: string, header: string) {
  return request.post("/api/webhooks/stripe", {
    headers: { "stripe-signature": header, "content-type": "application/json" },
    data: payload,
  });
}

test.describe("TikTok Events API — server CompletePayment (offline)", () => {
  test.beforeEach(async ({ request }) => {
    await resetMocks(request);
  });

  test("a completed checkout sends exactly one CompletePayment with the right shape + dedup id", async ({
    request,
  }) => {
    const sessionId = uniqueSessionId();
    const { payload, header } = signEvent(
      buildCheckoutCompleted({
        sessionId,
        amountTotal: 3549,
        contentIds: [SLUG],
      }),
    );

    const res = await postWebhook(request, payload, header);
    expect(res.status()).toBe(200);

    const calls = await ttCalls(request);
    expect(calls.filter((c) => c.type === "track")).toHaveLength(1);

    const { accessToken, body } = calls[0];
    expect(accessToken).toBe("test_tt_token");
    expect(body?.event_source).toBe("web");
    expect(body?.event_source_id).toBe("TEST_TT_PIXEL");
    expect(body?.data).toHaveLength(1);

    const ev = body!.data![0];
    expect(ev.event).toBe("CompletePayment");
    // Dedup key: same Stripe session id the browser CompletePayment uses.
    expect(ev.event_id).toBe(sessionId);
    expect(ev.properties.value).toBe(35.49);
    expect(ev.properties.currency).toBe("USD");
    expect(ev.properties.content_type).toBe("product");
    expect(ev.properties.contents[0].content_id).toBe(SLUG);
    expect(ev.properties.contents[0].price).toBe(PRICE / 100);
  });

  test("hashes email (lowercased) + phone (E.164 with leading +); ttp/ttclid stay raw", async ({
    request,
  }) => {
    const { payload, header } = signEvent(
      buildCheckoutCompleted({
        sessionId: uniqueSessionId(),
        contentIds: [SLUG],
        customer: {
          name: "Jane Doe",
          email: "Jane@Example.com", // mixed case -> must be lowercased before hashing
          phone: "+1 (555) 123-4567", // punctuation -> must normalize to +15551234567
        },
        ttp: "tt.p.raw",
        ttclid: "ttclid.raw",
      }),
    );
    await postWebhook(request, payload, header);

    const [{ body }] = await ttCalls(request);
    const user = body!.data![0].user;
    expect(user.email).toBe(sha256("jane@example.com"));
    expect(user.phone).toBe(sha256("+15551234567"));
    // Identifiers improve match quality and must NOT be hashed.
    expect(user.ttp).toBe("tt.p.raw");
    expect(user.ttclid).toBe("ttclid.raw");
  });

  test("a non-zero EAPI code is non-fatal: webhook still 200 + exactly one Printify order", async ({
    request,
  }) => {
    // Mock returns { code: 40001 } at HTTP 200 — a logical failure.
    await request.post(`${TT_MOCK}/__fail`, { data: { fail: true } });

    const { payload, header } = signEvent(
      buildCheckoutCompleted({ sessionId: uniqueSessionId(), contentIds: [SLUG] }),
    );
    const res = await postWebhook(request, payload, header);

    expect(res.status()).toBe(200); // tracking failure must never break fulfillment
    const pf = await pfCalls(request);
    expect(pf.filter((c) => c.type === "create")).toHaveLength(1);
  });
});
