# TikTok Ads — Setup & Runbook

This repo has the full **tracking backbone** for TikTok conversion ads: a browser
**Pixel**, a server-side **Events API (EAPI)**, and a product **catalog feed**. It
mirrors the Meta setup (see [META_ADS_SETUP.md](./META_ADS_SETUP.md)) almost exactly —
same files, same dedup model, just TikTok's API + event names.

> **Status (as of last edit): the Pixel AND the Events API are both LIVE and verified
> on prod.** All env vars (incl. `TIKTOK_EAPI_ACCESS_TOKEN`) are set locally and on
> Vercel (all environments). A direct test `CompletePayment` returned `{code:0, OK}`.
> See "Current state" below.

---

## Current state — what's done vs pending

| Item | State |
|---|---|
| Pixel code | `D8KDO1RC77UFK9KE34T0` (TikTok account "Gotham Gear_adv", advertiser id `7649605086869028884`) |
| Browser Pixel live on `gotham-goods.com` | ✅ deployed (commit that added TikTok tracking, on `main`) and verified in the live HTML |
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID`, `TIKTOK_PIXEL_ID` | ✅ set in `.env.local` AND Vercel (production + preview + development) = the pixel code |
| `/api/feed/tiktok` | ✅ live (HTTP 200, XML) |
| **`TIKTOK_EAPI_ACCESS_TOKEN`** | ✅ set in `.env.local` AND Vercel (encrypted, all envs); prod redeployed so functions see it |
| Server Events API verified | ✅ direct test `CompletePayment` (with `test_event_code`) returned `{code:0, OK}`; `phone` field accepted |
| `TIKTOK_TEST_EVENT_CODE` | unset (test-only — never set in prod, it diverts real events to the test panel) |
| TikTok Catalog feed registered in Catalog Manager | ⛔ pending (optional, for catalog/DSA ads) |

Both legs are live. The only remaining optional step is registering the catalog feed
(below). The EAPI access token is a **60-day-ish credential pattern on most TikTok
accounts — if server events silently stop, regenerate it** and re-set in Vercel +
`.env.local`, then redeploy.

---

## What the code does (already built)

| Piece | File | Behavior |
|---|---|---|
| Pixel loader | `app/layout.tsx` | Renders the TikTok loader only if `NEXT_PUBLIC_TIKTOK_PIXEL_ID` is set (right after the Meta loader). Fires the initial `ttq.page()`. |
| Client helpers | `lib/tiktok-pixel.ts` | `track()` (→ `ttq.track(evt, params, {event_id})`), `page()`, `getTtp()` (`_ttp` cookie), `getTtclid()` (`ttclid` URL param/cookie), `buildContents()` |
| Client events | `app/components/PixelEvents.tsx`, `app/components/cart.tsx` | PageView, ViewContent, AddToCart, InitiateCheckout, CompletePayment — fired alongside the Meta events, sharing one `event_id` |
| Server EAPI | `lib/tiktok-eapi.ts` | Hashed user data + dedup; **no-ops when env unset**; POSTs to `…/v1.3/event/track/` |
| Server InitiateCheckout | `app/api/checkout/route.ts` | Fires EAPI IC, stashes `tt_ttp`/`tt_ttclid` into Stripe metadata |
| Server CompletePayment (authoritative) | `app/api/webhooks/stripe/route.ts` | Fires on `checkout.session.completed`, deduped via the session id; **non-fatal** |
| Catalog feed | `app/api/feed/tiktok/route.ts` | Google-Shopping `g:` feed at `/api/feed/tiktok` from `lib/catalog.ts` |

Everything degrades gracefully: with no `TIKTOK_*` env vars, the site behaves exactly
as before (loader not rendered, EAPI returns early).

---

## Event model

| Fires at | TikTok event | Browser Pixel | Server EAPI |
|---|---|---|---|
| Route change | `ttq.page()` | ✅ | — |
| Hero product shown | `ViewContent` | ✅ | — |
| Add to cart | `AddToCart` | ✅ | — |
| Checkout click | `InitiateCheckout` | ✅ | ✅ (checkout route) |
| Payment complete | **`CompletePayment`** | ✅ (thank-you page) | ✅ (Stripe webhook) |

- TikTok's purchase event is **`CompletePayment`** (not Meta's `Purchase`).
- Params use a **`contents`** array (`content_id`, `content_type`, `content_name`,
  `quantity`, `price`) plus top-level `value` + `currency`. `content_id` = the product
  **slug** — same value Meta's `content_ids` and both feeds use, so catalog
  attribution lines up.
- **Dedup:** every browser event carries an `event_id`; the matching server EAPI event
  sends the same id and TikTok dedups on `(event, event_id)`. The same `event_id`
  string is reused across Meta + TikTok at each firing point (per-vendor dedup, so
  sharing is harmless). CompletePayment uses the **Stripe session id** as the shared
  id (client on `/thank-you`, server in the webhook).

### TikTok-specific gotchas (vs Meta)
- **Phone hashing** is E.164 **keeping the leading `+`** (Meta strips it). Email is
  lowercased+trimmed then SHA-256; `external_id` SHA-256. `ttp`/`ttclid`/`ip`/
  `user_agent` are sent **raw**.
- **HTTP 200 ≠ success.** TikTok returns 200 even on logical errors, signalling
  success via `code: 0`. `lib/tiktok-eapi.ts` throws on a non-zero `code` (caught
  non-fatally by callers).
- **Field name `phone` is confirmed correct** for the v1.3 `event/track` endpoint — a
  live test event with a hashed `phone` returned `{code:0}` with no warning. (Legacy
  v1.2 used `phone_number`; not relevant here.)

---

## TikTok Events Manager wizard (the 8-step "Pixel + Events API setup guide")

1. **Create pixel** ✅ done (pixel `D8KDO1RC77UFK9KE34T0`).
2. **Install base code** ✅ done in code (`app/layout.tsx`) and deployed.
3. **Manage configurations** ✅.
4. **Set up events** → **don't use Event Builder.** We hand-coded the events, so click
   **"switch to custom code"** → **Next**. (Earlier this step showed "We can't detect
   pixel … base code on your page" — that was only because the pixel wasn't deployed
   yet. It resolves once the deploy is live + you re-check the URL.)
5. **Verify Pixel setup** — load `gotham-goods.com`; the TikTok Pixel Helper extension
   should show PageView, plus AddToCart / InitiateCheckout when you use the cart.
6. **Set up business funnel** — map events to funnel stages (View → AddToCart →
   InitiateCheckout → CompletePayment). Optimize CompletePayment for purchase
   campaigns.
7. **Implement Events API** — this is where you **Generate Access Token**. Paste it
   into `TIKTOK_EAPI_ACCESS_TOKEN` (Vercel + `.env.local`) and redeploy.
8. **Verify eAPI setup** — set `TIKTOK_TEST_EVENT_CODE` temporarily, run a Stripe test
   purchase, and confirm the server `CompletePayment`/`InitiateCheckout` appear in
   **Test Events**, the response `code` is `0`, and the browser+server pair **dedupes**
   (matching `event_id`). Remove `TIKTOK_TEST_EVENT_CODE` when done.

---

## Catalog feed (optional, for catalog / Dynamic Showcase Ads)

`/api/feed/tiktok` serves a Google-Shopping RSS feed from `lib/catalog.ts`. In TikTok
**Catalog Manager** add a data feed source = `https://gotham-goods.com/api/feed/tiktok`
(scheduled). `g:id` = product slug = the Pixel/EAPI `content_id`, so events attribute
to catalog products. It auto-reflects whatever is in the deployed catalog.

---

## Env var reference

| Var | Public | Where used |
|---|---|---|
| `NEXT_PUBLIC_TIKTOK_PIXEL_ID` | yes | `app/layout.tsx`, `lib/tiktok-pixel.ts` (the pixel code, baked into the browser bundle) |
| `TIKTOK_PIXEL_ID` | no | `lib/tiktok-eapi.ts` — same value, used as `event_source_id` |
| `TIKTOK_EAPI_ACCESS_TOKEN` | no | `lib/tiktok-eapi.ts` — Events API auth (set, encrypted, all envs) |
| `TIKTOK_TEST_EVENT_CODE` | no | `lib/tiktok-eapi.ts` — Test Events validation only (remove in prod) |
| `TIKTOK_EAPI_BASE` | no | `lib/tiktok-eapi.ts` — optional; defaults to `https://business-api.tiktok.com/open_api/v1.3` |

Set the server-only vars in Vercel (all environments). Only
`NEXT_PUBLIC_TIKTOK_PIXEL_ID` reaches the browser. To mirror a value to Vercel
non-interactively, use the REST API with the `VERCEL_TOKEN` in `.env.local`
(`POST /v10/projects/{projectId}/env?teamId={teamId}&upsert=true`,
project `prj_Ha4P8NYYgltVazpunQZAZIYnlNpZ`, team `team_xlIU6Qg7M9pYpZd9psVnbfSB`).

---

## Tests

Offline Playwright tests (no live TikTok/Stripe), run with `npm test`:

| File | Covers |
|---|---|
| `tests/tiktok-eapi.spec.ts` | Server CompletePayment shape, dedup `event_id` = session id, SHA-256 hashing (email lowercased, phone E.164 `+`), `ttp`/`ttclid` raw, and that a non-zero EAPI `code` is non-fatal (webhook still 200 + order created) |
| `tests/tiktok-pixel.spec.ts` | Browser Pixel: PageView, ViewContent, AddToCart, InitiateCheckout fire with correct params + `event_id` (real SDK blocked; `window.ttq` queue inspected) |
| `tests/feed.spec.ts` | `/api/feed/tiktok` serves XML with every product slug |
| `tests/mock-tiktok.mjs` | Mock Events API on :4011 (records calls; `__fail` mode returns `code: 40001`) — booted by `tests/global-setup.ts`; base pointed at it via `.env.test` (`TIKTOK_EAPI_BASE`) |

Note: the worktree deploy path can't run Playwright (Turbopack rejects the symlinked
`node_modules`) — verify there with `npx tsc --noEmit`; run the full suite from the
main repo dir.

---

## Deploying changes

Prod is `main` (auto-deploys on Vercel). The primary working dir is usually on a
parallel branch with WIP — **ship via an isolated worktree off `origin/main`**, commit
only the TikTok files, push `HEAD:main`. See
[gotham-goods-worktree-deploys](../) memory / `META_ADS_SETUP.md` for the exact flow.
After setting `TIKTOK_EAPI_ACCESS_TOKEN` in Vercel, trigger a redeploy so functions
pick it up.
