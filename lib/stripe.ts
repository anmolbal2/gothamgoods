import Stripe from "stripe";

/**
 * Shared Stripe client. The secret key comes from the environment.
 *
 * The placeholder fallback lets the Next server boot (and `next build` run, and
 * the offline webhook tests pass) even when no real key is configured — webhook
 * signature verification uses STRIPE_WEBHOOK_SECRET, not this key, so Layer B
 * tests work with the placeholder. Real Checkout/retrieve calls require a real key.
 */
const apiKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_offline";

export const stripe = new Stripe(apiKey);
