import { test, expect, type Page } from "@playwright/test";

/**
 * Offline proof of the browser TikTok Pixel wiring. We block the real
 * analytics.tiktok.com SDK so `window.ttq` stays the loader's queue-stub array —
 * every ttq.track()/ttq.page() call just pushes [method, ...args] onto it. Reading
 * that queue lets us assert our events fire with the right params + event_id without
 * touching a real TikTok account or Stripe (the AddToCart/InitiateCheckout pixel
 * calls fire before the /api/checkout fetch, so they're captured even offline).
 */

type Entry = unknown[];

async function blockExternalPixels(page: Page) {
  await page.route("https://analytics.tiktok.com/**", (r) => r.abort());
  await page.route("https://connect.facebook.net/**", (r) => r.abort());
}

async function waitForTtq(page: Page) {
  await page.waitForFunction(() =>
    Array.isArray((window as unknown as { ttq?: unknown }).ttq),
  );
}

function trackEntries(page: Page, name: string): Promise<Entry[]> {
  return page.evaluate((n) => {
    const q = ((window as unknown as { ttq?: unknown[] }).ttq ?? []) as unknown[];
    return q.filter(
      (e) => Array.isArray(e) && e[0] === "track" && e[1] === n,
    ) as unknown[][];
  }, name);
}

test.describe("TikTok Pixel — browser events (offline)", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalPixels(page);
    // Suppress the sale takeover via its own session gate so clicks aren't blocked.
    await page.addInitScript(() => sessionStorage.setItem("gg_sale_takeover_v1", "1"));
  });

  test("loader fires a PageView and the hero fires ViewContent", async ({ page }) => {
    await page.goto("/");
    await waitForTtq(page);

    // The loader snippet calls ttq.page() once on boot.
    const pageViews = await page.evaluate(
      () =>
        (((window as unknown as { ttq?: unknown[] }).ttq ?? []) as unknown[]).filter(
          (e) => Array.isArray(e) && e[0] === "page",
        ).length,
    );
    expect(pageViews).toBeGreaterThanOrEqual(1);

    // ViewContent fires from a useEffect after hydration — poll for it.
    await expect
      .poll(async () => (await trackEntries(page, "ViewContent")).length)
      .toBeGreaterThan(0);
    const [vc] = await trackEntries(page, "ViewContent");
    const params = vc[2] as { contents: Array<{ content_id: string }>; currency: string };
    const opts = vc[3] as { event_id: string };
    expect(params.contents[0].content_id).toBeTruthy();
    expect(params.currency).toBe("USD");
    expect(opts.event_id).toBeTruthy();
  });

  test("Add to cart fires AddToCart with content_id, value and an event_id", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForTtq(page);

    await page.getByTestId("add-to-cart").first().click();

    await expect
      .poll(async () => (await trackEntries(page, "AddToCart")).length)
      .toBeGreaterThan(0);
    const [atc] = await trackEntries(page, "AddToCart");
    const params = atc[2] as {
      contents: Array<{ content_id: string }>;
      value: number;
      currency: string;
    };
    const opts = atc[3] as { event_id: string };
    expect(params.contents[0].content_id).toBeTruthy();
    expect(params.value).toBeGreaterThan(0);
    expect(params.currency).toBe("USD");
    expect(opts.event_id).toBeTruthy();
  });

  test("Checkout click fires InitiateCheckout before the network call", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForTtq(page);

    await page.getByTestId("add-to-cart").first().click();
    await page.getByTestId("cart-checkout").click();

    await expect
      .poll(async () => (await trackEntries(page, "InitiateCheckout")).length)
      .toBeGreaterThan(0);
    const [ic] = await trackEntries(page, "InitiateCheckout");
    const params = ic[2] as { value: number; currency: string };
    const opts = ic[3] as { event_id: string };
    expect(params.value).toBeGreaterThan(0);
    expect(params.currency).toBe("USD");
    expect(opts.event_id).toBeTruthy();
  });
});
