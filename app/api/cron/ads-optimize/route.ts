import {
  marketingConfigured,
  getAdInsights,
  pauseAd,
  getAdSetBudget,
  setAdSetBudget,
  uploadImage,
  createAdWithCopy,
} from "@/lib/meta-marketing";
import { listProducts, type Product } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-improvement loop for the live Meta ad set. Triggered by GitHub Actions
 * (~every 6h) + the daily Vercel cron — both send `Authorization: Bearer <CRON_SECRET>`.
 * Full-auto: pauses sub-ROAS / no-conversion ads, scales budget toward the daily
 * cap on winners, and spins up a fresh scarcity/urgency creative each run.
 * Never throws — a failure in any step is logged and the rest continue.
 */
function envNum(key: string, fallback: number): number {
  const v = parseFloat(process.env[key] || "");
  return Number.isFinite(v) ? v : fallback;
}

/** Guardrail: blank-back mockups (camera_label *back* / camera id 98446) must never run as ads. */
function isBackImage(url: string): boolean {
  return /camera_label=[^&"']*back/i.test(url) || url.includes("/98446/");
}

/**
 * First non-back image for ad creative. Prefers the Black colorway (White tees
 * render white-on-white in ads), then any non-White color, then colors[0].
 */
function pickAdImage(p: Product): string | undefined {
  const candidates = [
    p.colors.find((c) => c.name === "Black"),
    p.colors.find((c) => c.name !== "White"),
    p.colors[0],
  ];
  for (const c of candidates) {
    if (!c) continue;
    for (const url of [c.image, ...(c.images || [])]) {
      if (url && !isBackImage(url)) return url;
    }
  }
  return undefined;
}

/** Generate one fresh scarcity/urgency ad copy via the Claude API. */
async function generateScarcityCopy(
  productName: string,
  blurb: string,
): Promise<{ message: string; headline: string } | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
  const system =
    "You write punchy, irreverent NYC fan-merch ad copy for Gotham Goods. " +
    "RIGHT NOW: the Knicks just WON the 2026 NBA title in GAME 5 — their first since 1973 — and these checklist " +
    "tees literally predicted 'KNICKS IN 5'. Every ad must LEAD with the championship + 'we called it / the shirt " +
    "that called it' pride. The tees are $49.99. Mention free shipping from New Jersey. Fan-made, never claims NBA affiliation.";
  const user =
    `Write ONE fresh ad for the "${productName}" tee ($49.99). Respond with STRICT JSON only:\n` +
    `{"message":"primary text, <=200 chars, opens with the championship win + 'we called it / Knicks in 5' angle","headline":"<=40 chars, championship/we-called-it angle"}\n\n` +
    `Product vibe: ${blurb.slice(0, 200)}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 400, system, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end < 0) return null;
    const o = JSON.parse(text.slice(start, end + 1));
    if (!o.message || !o.headline) return null;
    return { message: String(o.message).slice(0, 280), headline: String(o.headline).slice(0, 60) };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!marketingConfigured()) {
    return Response.json({ ok: false, reason: "marketing env not configured" });
  }

  const FLOOR = envNum("META_ROAS_FLOOR", 1.3);
  const KILL = envNum("META_CPA_KILL", 25);
  const MIN = envNum("META_MIN_SPEND", 15);
  const SCALE = envNum("META_SCALE_ROAS", 2.0);

  const result = {
    paused: [] as string[],
    scaled: null as { from: number; to: number; roas: number } | null,
    newAds: [] as string[],
    refresh: "" as string,
    errors: [] as string[],
  };

  // 1) pull insights + pause losers
  let insights: Awaited<ReturnType<typeof getAdInsights>> = [];
  try {
    insights = await getAdInsights("last_3d");
    for (const a of insights) {
      const hasSignal = a.spend >= MIN && a.impressions >= 1000;
      const losing = a.roas < FLOOR || (a.purchases === 0 && a.spend >= KILL);
      if (hasSignal && losing) {
        try {
          await pauseAd(a.ad_id);
          result.paused.push(`${a.ad_name} (roas ${a.roas.toFixed(2)}, $${a.spend.toFixed(0)})`);
        } catch (e) {
          result.errors.push(`pause ${a.ad_id}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  } catch (e) {
    result.errors.push(`insights: ${e instanceof Error ? e.message : e}`);
  }

  // 2) scale budget when winning + delivery-capped (avg daily spend near budget)
  try {
    const totalSpend = insights.reduce((s, a) => s + a.spend, 0);
    const totalValue = insights.reduce((s, a) => s + a.purchase_value, 0);
    const campRoas = totalSpend > 0 ? totalValue / totalSpend : 0;
    const budgetCents = await getAdSetBudget();
    const avgDaily = totalSpend / 3;
    if (campRoas >= SCALE && avgDaily >= 0.8 * (budgetCents / 100)) {
      const next = Math.round(budgetCents * 1.2);
      await setAdSetBudget(next);
      result.scaled = { from: budgetCents / 100, to: next / 100, roas: campRoas };
    }
  } catch (e) {
    result.errors.push(`scale: ${e instanceof Error ? e.message : e}`);
  }

  // 3) creative refresh — one fresh scarcity/urgency ad per run
  try {
    const products = listProducts();
    if (!products.length) {
      result.refresh = "skipped: no products";
    } else {
      // Spearhead the two "starter pack" checklist tees that called Knicks-in-5
      // (fall back to all products if neither is in the catalog).
      const FOCUS = ["popes-on-our-side", "saturday-night-live"];
      const pool = products.filter((x) => FOCUS.includes(x.id));
      const choices = pool.length ? pool : products;
      const p = choices[Math.floor(Math.random() * choices.length)];
      const img = pickAdImage(p);
      const copy = await generateScarcityCopy(p.name, p.blurb || "");
      if (!img) {
        result.refresh = `skipped: ${p.id} has no image`;
      } else if (!copy) {
        result.refresh = "skipped: copy generation returned null (check ANTHROPIC_API_KEY)";
      } else {
        const hash = await uploadImage(img);
        if (!hash) {
          result.refresh = `failed: image upload returned no hash (img ${img})`;
        } else {
          const adId = await createAdWithCopy({
            name: `${p.id}-${Date.now()}`,
            message: copy.message,
            headline: copy.headline,
            imageHash: hash,
          });
          if (adId) {
            result.newAds.push(adId);
            result.refresh = `created ad ${adId} for ${p.id}`;
          } else {
            result.refresh = "failed: ad creation returned no id";
          }
        }
      }
    }
  } catch (e) {
    result.refresh = "error";
    result.errors.push(`refresh: ${e instanceof Error ? e.message : e}`);
  }

  return Response.json({ ok: true, checked: insights.length, ...result });
}
