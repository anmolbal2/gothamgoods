# Meta (Facebook/Instagram) Ads — Setup & Runbook

This repo now has the **tracking backbone** for Meta conversion ads: a browser Pixel,
server-side Conversions API (CAPI), and a product feed. The campaign engine is
**Larven** (an external AI ad tool) — it connects to your Meta ad account and store
URL and runs creative + launch + optimization. This doc is the one-time setup
(~10 min of human steps) plus how to verify everything works.

> **Gate:** do not spend a dollar until the Pixel + CAPI show green in Meta's Test
> Events tool (step 6). Larven optimizing against a blind pixel is the failure mode.

---

## What the code does (already built)

| Piece | File | Behavior |
|---|---|---|
| Pixel loader + domain verify | `app/layout.tsx` | Renders the Pixel only if `NEXT_PUBLIC_META_PIXEL_ID` is set; adds the `facebook-domain-verification` tag from `META_DOMAIN_VERIFICATION` |
| Client events | `app/components/PixelEvents.tsx`, `app/components/cart.tsx`, `app/page.tsx` | PageView, ViewContent, AddToCart, InitiateCheckout, Purchase |
| Server CAPI | `lib/meta-capi.ts` | Hashed user data + dedup; **no-ops when env unset** |
| Server InitiateCheckout | `app/api/checkout/route.ts` | Fires CAPI IC, stashes `event_id`/`fbp`/`fbc`/content_ids into Stripe metadata |
| Server Purchase (authoritative) | `app/api/webhooks/stripe/route.ts` | Fires on `checkout.session.completed`, deduped via the session id; **non-fatal** |
| Product feed | `app/api/feed/meta/route.ts` | RSS/`g:` feed at `/api/feed/meta` from the catalog |

Everything degrades gracefully: with no `META_*` env vars set, the site behaves
exactly as before.

**Event dedup:** every browser event carries an `eventID`; the matching server CAPI
event sends the same id. Purchase uses the **Stripe session id** as the shared id
(client on the thank-you page, server in the webhook).

---

## One-time bootstrap (~10 min)

Do these in [business.facebook.com](https://business.facebook.com). Capture the
values into Vercel env vars (and `.env.local` for local testing).

1. **Business + accounts** — Create a Business Portfolio. Convert your Instagram to a
   Business/Creator account and link it to a new Facebook Page.
2. **Payment + spend cap** — Add a payment method. Set the **account spend limit to
   $5,000** (Billing → Payment settings) as a hard backstop.
3. **Business verification** — Start it (Business Settings → Security Center). Lifts
   the new-account daily spend cap and unlocks the Marketing API. Review is async.
4. **Pixel / dataset** — Events Manager → create a dataset (Pixel). Copy the numeric
   **Pixel ID** → set both `NEXT_PUBLIC_META_PIXEL_ID` and `META_PIXEL_ID`.
   Generate a **Conversions API access token** (dataset → Settings) →
   `META_CAPI_ACCESS_TOKEN`. Grab a **Test Event Code** (Test Events tab) →
   `META_TEST_EVENT_CODE` (temporary).
5. **Domain verification** — Business Settings → Brand Safety → Domains → add
   `gothamgoods.vercel.app`. Use the **meta-tag** method; paste the token into
   `META_DOMAIN_VERIFICATION`, deploy, then click **Verify**.
6. **Validate tracking (the gate)** — Set the env vars in Vercel, redeploy. Open the
   site, then in **Events Manager → Test Events** confirm PageView / ViewContent /
   AddToCart fire. Do a real test checkout ($1 test product or a live $1 you refund)
   and confirm **InitiateCheckout** and **Purchase** appear, that browser+server
   Purchase **dedupe** (one Purchase, received via both Browser and Server), and that
   Event Match Quality is at least "Good". Remove `META_TEST_EVENT_CODE` when done.
7. **Catalog + feed** — Commerce Manager → create a Catalog → add a **Data Feed**
   source = `https://gothamgoods.vercel.app/api/feed/meta`, scheduled hourly/daily.
   Confirm it ingests with 0 errors and `g:id` values match the Pixel `content_ids`.

---

## Connect Larven (~2 min)

In Larven (start on the free 7-day trial):

1. Connect the **Meta ad account, Page, and Instagram**.
2. Point it at the **store URL** (`https://gothamgoods.vercel.app`).
3. Set a **daily spend ceiling** matching the pacing plan (start ~$75–150/day).
4. Use the **same Pixel** you created in step 4 (don't let it create a second one).
5. Launch. Larven generates creative, builds the Advantage+ campaign, and runs the
   daily auto-pause / auto-scale loop against your Pixel's conversion signal.

Start optimizing for a higher-funnel event (AddToCart / InitiateCheckout) while the
pixel is cold; switch to Purchase once ~20–30 purchases have accumulated.

---

## New product drops

The feed at `/api/feed/meta` auto-reflects whatever is in `lib/catalog.ts`, and
Larven re-scrapes the store URL — so once a new product is in the deployed catalog,
ads pick it up with no further touch. Today new products enter the catalog by editing
the curated `PRODUCTS` list in `scripts/gen-catalog.mjs` and re-running it:

```
node --env-file=.env.local scripts/gen-catalog.mjs
```

(Fully zero-touch discovery of brand-new Printify products — using Printify titles as
fallback metadata, on a cron — is a possible follow-up; see the plan.)

---

## Env var reference

| Var | Public | Where used |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | yes | `app/layout.tsx`, `lib/meta-pixel.ts` |
| `META_PIXEL_ID` | no | `lib/meta-capi.ts` (same value as the public one) |
| `META_CAPI_ACCESS_TOKEN` | no | `lib/meta-capi.ts` |
| `META_TEST_EVENT_CODE` | no | `lib/meta-capi.ts` (validation only) |
| `META_DOMAIN_VERIFICATION` | no (not secret) | `app/layout.tsx` |
| `META_GRAPH_BASE` | no | `lib/meta-capi.ts` (optional override) |

Set the server-only vars in Vercel (and GitHub Actions secrets if used by future
crons). Only `NEXT_PUBLIC_META_PIXEL_ID` and the (non-secret) verification token
reach the browser.
