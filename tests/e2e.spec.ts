import { test, expect } from "@playwright/test";

// Layer A needs a real Stripe TEST key (drives Stripe's hosted checkout). Skips
// cleanly when one isn't configured so `npm test` stays green offline.
test.skip(
  process.env.E2E_STRIPE_READY !== "1",
  "Set a real Stripe test key in .env.local to run the live checkout E2E.",
);

/**
 * Proves the buyer flow + server-side pricing end to end against REAL Stripe
 * (test mode): the storefront renders from the catalog, "Buy now" creates a real
 * Checkout Session, and Stripe's hosted page shows the correct product and total
 * computed server-side ($39.99 item + free shipping = $39.99).
 *
 * Completing the card form and landing on /thank-you is intentionally left to the
 * manual `stripe listen` smoke test (Part 3 of the brief): automating Stripe's
 * hosted Payment Element (Link + accordion + cross-origin card iframes + Google
 * address autocomplete) is brittle by design, and that manual test is also the
 * only way to exercise the webhook -> Printify production loop safely.
 */
test("Buy redirects to Stripe Checkout with the correct server-priced order", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await page.goto("/");

  const card = page.getByTestId("product-card").first();
  await expect(card).toBeVisible();
  const productName = (await card.getByTestId("product-name").innerText()).trim();

  // Add to cart -> cart drawer opens -> checkout.
  await card.getByTestId("add-to-cart").click();
  await page.getByTestId("cart-checkout").click();

  // Redirects to the real Stripe-hosted checkout.
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });

  // Stripe renders the order we priced server-side from the catalog.
  await expect(page.getByText(productName, { exact: false }).first()).toBeVisible({
    timeout: 20_000,
  });
  // $39.99 item + free shipping = $39.99 total — all computed server-side.
  await expect(page.getByText("$39.99").first()).toBeVisible({ timeout: 20_000 });
});
