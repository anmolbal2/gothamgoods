import { test, expect } from "@playwright/test";
import { listProducts } from "../lib/catalog";

/**
 * The TikTok catalog feed must serve valid Google-Shopping XML with one <g:id> per
 * product slug — the same slugs the Pixel/EAPI send as content_id, so TikTok can tie
 * catalog products to conversion events.
 */
test("TikTok product feed serves XML with every product slug", async ({ request }) => {
  const res = await request.get("/api/feed/tiktok");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("xml");

  const xml = await res.text();
  for (const p of listProducts()) {
    expect(xml).toContain(`<g:id>${p.id}</g:id>`);
  }
  expect(xml).toMatch(/<g:price>\d+\.\d{2} USD<\/g:price>/);
});

test("comeback sale: feeds carry list price + lower sale price", async ({ request }) => {
  const onSale = listProducts().filter(
    (p) => p.compareAtCents !== undefined && p.compareAtCents > p.priceCents,
  );
  test.skip(onSale.length === 0, "no sale running");

  for (const path of ["/api/feed/tiktok", "/api/feed/meta"]) {
    const xml = await (await request.get(path)).text();
    const p = onSale[0];
    const price = (p.compareAtCents! / 100).toFixed(2);
    const sale = (p.priceCents / 100).toFixed(2);
    expect(xml).toContain(`<g:price>${price} USD</g:price>`);
    expect(xml).toContain(`<g:sale_price>${sale} USD</g:sale_price>`);
    expect(p.priceCents).toBeLessThan(p.compareAtCents!);
  }
});
