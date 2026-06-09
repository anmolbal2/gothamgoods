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
];
const serverEnv: Record<string, string> = {};
for (const k of SERVER_ENV_KEYS) serverEnv[k] = process.env[k] ?? "";
// NOTE: STRIPE_SECRET_KEY is intentionally NOT overridden, so the live E2E
// (Layer A) picks up the real test key from .env.local.

/** Detect a real Stripe test key (for gating Layer A) without exposing the value. */
function realStripeKeyAvailable(): boolean {
  const fromEnv = process.env.STRIPE_SECRET_KEY;
  const isReal = (v?: string) =>
    !!v && v.startsWith("sk_") && !v.includes("placeholder") && v !== "sk_test_dummy";
  if (isReal(fromEnv)) return true;
  if (existsSync(".env.local")) {
    const m = readFileSync(".env.local", "utf8").match(
      /^\s*STRIPE_SECRET_KEY\s*=\s*(.+?)\s*$/m,
    );
    if (isReal(m?.[1]?.trim())) return true;
  }
  return false;
}
process.env.E2E_STRIPE_READY = realStripeKeyAvailable() ? "1" : "";

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
