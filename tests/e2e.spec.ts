import { test, expect, type Page } from "@playwright/test";

// Layer A needs a real Stripe TEST key (drives Stripe's hosted checkout). Skips
// cleanly when one isn't configured so `npm test` stays green offline.
test.skip(
  process.env.E2E_STRIPE_READY !== "1",
  "Set a real Stripe test key in .env.local to run the live checkout E2E.",
);

async function fillFirst(page: Page, selectors: string[], value: string) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

/**
 * Fill Stripe's hosted checkout page. Fields live on checkout.stripe.com (same
 * origin, so no frameLocator needed for the hosted flow). Selectors are best-known
 * stable ids/labels with fallbacks; Stripe's DOM shifts occasionally.
 */
async function fillStripeCheckout(page: Page) {
  await fillFirst(page, ['input#email', 'input[name="email"]'], "e2e-buyer@example.com");
  await fillFirst(page, ['input#cardNumber', 'input[name="cardNumber"]'], "4242424242424242");
  await fillFirst(page, ['input#cardExpiry', 'input[name="cardExpiry"]'], "12 / 34");
  await fillFirst(page, ['input#cardCvc', 'input[name="cardCvc"]'], "123");
  await fillFirst(page, ['input#billingName', 'input[name="billingName"]'], "E2E Buyer");

  // Shipping address (we enable US shipping collection).
  await fillFirst(
    page,
    ['input#shippingAddressLine1', 'input[name="shippingAddressLine1"]'],
    "20 W 34th St",
  );
  await fillFirst(
    page,
    ['input#shippingLocality', 'input[name="shippingLocality"]'],
    "New York",
  );
  // State: Stripe uses a <select> for US administrative area.
  const stateSel = page
    .locator('select#shippingAdministrativeArea, select[name="shippingAdministrativeArea"]')
    .first();
  if ((await stateSel.count()) > 0) {
    await stateSel.selectOption("NY").catch(() => {});
  }
  await fillFirst(
    page,
    [
      'input#shippingPostalCode',
      'input[name="shippingPostalCode"]',
      'input#billingPostalCode',
      'input[name="billingPostalCode"]',
    ],
    "10001",
  );
  await fillFirst(
    page,
    ['input#shippingName', 'input[name="shippingName"]'],
    "E2E Buyer",
  );

  // Phone (we enable phone collection).
  await fillFirst(page, ['input#phoneNumber', 'input[name="phoneNumber"]'], "2125550100");

  // Pay.
  const pay = page
    .locator('[data-testid="hosted-payment-submit-button"], button[type="submit"]')
    .first();
  await pay.click();
}

test("buyer purchases a tee via Stripe and lands on thank-you", async ({ page }) => {
  await page.goto("/");

  const card = page.getByTestId("product-card").first();
  await expect(card).toBeVisible();
  const productName = (await card.getByTestId("product-name").innerText()).trim();

  await card.getByTestId("buy-button").click();

  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
  await fillStripeCheckout(page);

  await page.waitForURL(/\/thank-you/, { timeout: 60_000 });
  await expect(page.getByText(productName, { exact: false })).toBeVisible();
});
