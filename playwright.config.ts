import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Load offline test overrides into the runner's process.env. Fixtures read the
// webhook secret from here, and these values are forwarded to the dev server
// below (where they win over .env.local because process.env is rank #1 in
// Next's env load order).
process.loadEnvFile(".env.test");

const SERVER_ENV_KEYS = [
  "SITE_URL",
  "STRIPE_WEBHOOK_SECRET",
  "PRINTIFY_API_BASE",
  "PRINTIFY_API_TOKEN",
  "PRINTIFY_SHOP_ID",
  // Empty -> force in-memory store + logged emails even though .env.local has creds.
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  // TikTok tracking — test pixel/token + the EAPI base pointed at the mock (:4011)
  // so the browser Pixel loader renders and all server events hit the mock.
  "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
  "TIKTOK_PIXEL_ID",
  "TIKTOK_EAPI_ACCESS_TOKEN",
  "TIKTOK_TEST_EVENT_CODE",
  "TIKTOK_EAPI_BASE",
];
const serverEnv: Record<string, string> = {};
for (const k of SERVER_ENV_KEYS) serverEnv[k] = process.env[k] ?? "";

// Read the Stripe TEST key straight from .env.local and force it onto the dev
// server. This deliberately ignores any sk_/rk_ key leaked into the shell env
// (e.g. a leftover live key) so tests can never hit a live Stripe account.
function testStripeKeyFromEnvLocal(): string | undefined {
  if (!existsSync(".env.local")) return undefined;
  const m = readFileSync(".env.local", "utf8").match(
    /^\s*STRIPE_SECRET_KEY\s*=\s*(.+?)\s*$/m,
  );
  const v = m?.[1]?.trim();
  return v && v.startsWith("sk_test_") ? v : undefined;
}
const testStripeKey = testStripeKeyFromEnvLocal();
if (testStripeKey) serverEnv.STRIPE_SECRET_KEY = testStripeKey;
process.env.E2E_STRIPE_READY = testStripeKey ? "1" : "";

export default defineConfig({
  testDir: "./tests",
  workers: 1, // shared dev server + in-memory store -> run serially for determinism
  fullyParallel: false,
  reporter: process.env.CI ? "line" : "list",
  use: { baseURL: "http://localhost:3000" },
  globalSetup: "./tests/global-setup.ts",
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: serverEnv,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
