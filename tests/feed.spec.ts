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

test("no sale: feeds emit a flat g:price and no g:sale_price", async ({ request }) => {
  for (const path of ["/api/feed/tiktok", "/api/feed/meta"]) {
    const xml = await (await request.get(path)).text();
    expect(xml).toContain(`<g:price>39.99 USD</g:price>`);
    expect(xml).not.toContain("g:sale_price");
  }
});
