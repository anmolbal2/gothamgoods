/**
 * Meta Marketing API client for the ads-optimize cron. Mirrors the lib/meta-capi.ts
 * pattern: module-level base URL, lazy env reads, helpers that throw with the
 * response body on non-2xx so the caller can log. Uses META_MKTG_TOKEN (a
 * long-lived user/marketing token with ads_management).
 *
 * No-ops gracefully when the token/account env isn't configured.
 */

const GRAPH = process.env.META_GRAPH_BASE || "https://graph.facebook.com/v21.0";

function token(): string {
  return process.env.META_MKTG_TOKEN ?? "";
}
function adAccount(): string {
  const id = process.env.META_AD_ACCOUNT_ID;
  if (!id) throw new Error("META_AD_ACCOUNT_ID is not set");
  return id.startsWith("act_") ? id : `act_${id}`;
}
function adSetId(): string {
  const id = process.env.META_AD_SET_ID;
  if (!id) throw new Error("META_AD_SET_ID is not set");
  return id;
}

export function marketingConfigured(): boolean {
  return Boolean(process.env.META_MKTG_TOKEN && process.env.META_AD_ACCOUNT_ID && process.env.META_AD_SET_ID);
}

async function getJson(path: string): Promise<Record<string, unknown> & { data?: unknown[] }> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH}/${path}${sep}access_token=${encodeURIComponent(token())}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta GET ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}
async function postForm(path: string, body: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ ...body, access_token: token() }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta POST ${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : {};
}

export interface AdInsight {
  ad_id: string;
  ad_name: string;
  spend: number;
  impressions: number;
  purchases: number;
  purchase_value: number;
  roas: number;
}

interface ActionEntry {
  action_type: string;
  value: string;
}
function actionValue(arr: ActionEntry[] | undefined, type: string): number {
  const m = (arr || []).find(
    (a) => a.action_type === type || a.action_type === `offsite_conversion.fct.${type}`,
  );
  return m ? parseFloat(m.value || "0") : 0;
}

/** Per-ad insights for the configured ad set (default last 3 days). */
export async function getAdInsights(datePreset = "last_3d"): Promise<AdInsight[]> {
  const data =
    ((await getJson(
      `${adSetId()}/insights?level=ad&fields=ad_id,ad_name,spend,impressions,actions,action_values&date_preset=${datePreset}`,
    )).data as Array<Record<string, unknown>>) || [];
  return data.map((d) => {
    const spend = parseFloat((d.spend as string) || "0");
    const purchase_value = actionValue(d.action_values as ActionEntry[], "purchase");
    return {
      ad_id: d.ad_id as string,
      ad_name: d.ad_name as string,
      spend,
      impressions: parseInt((d.impressions as string) || "0", 10),
      purchases: actionValue(d.actions as ActionEntry[], "purchase"),
      purchase_value,
      roas: spend > 0 ? purchase_value / spend : 0,
    };
  });
}

export async function pauseAd(adId: string): Promise<void> {
  await postForm(adId, { status: "PAUSED" });
}

/** Ad set daily budget in cents. */
export async function getAdSetBudget(): Promise<number> {
  return parseInt(((await getJson(`${adSetId()}?fields=daily_budget`)).daily_budget as string) || "0", 10);
}
export async function setAdSetBudget(cents: number): Promise<void> {
  await postForm(adSetId(), { daily_budget: String(Math.round(cents)) });
}

/** Fetch an image by URL and upload to the ad account; returns the image hash. */
export async function uploadImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    const bytes = Buffer.from(await r.arrayBuffer()).toString("base64");
    const up = (await postForm(`${adAccount()}/adimages`, { bytes })) as {
      images?: Record<string, { hash: string }>;
    };
    const key = up.images && Object.keys(up.images)[0];
    return key ? up.images![key].hash : null;
  } catch {
    return null;
  }
}

/** Create a single-image link ad in the configured ad set (ACTIVE). Returns the ad id. */
export async function createAdWithCopy(args: {
  name: string;
  message: string;
  headline: string;
  imageHash: string;
}): Promise<string | null> {
  const page = process.env.META_PAGE_ID;
  const link = (process.env.SITE_URL || "https://gotham-goods.com").replace(/\/$/, "") + "/";
  const creative = (await postForm(`${adAccount()}/adcreatives`, {
    name: `auto-${args.name}`,
    object_story_spec: JSON.stringify({
      page_id: page,
      link_data: {
        message: args.message,
        link,
        name: args.headline,
        description: "⏳ Limited Finals drop · free shipping from NJ in 2–3 days",
        call_to_action: { type: "SHOP_NOW", value: { link } },
        image_hash: args.imageHash,
      },
    }),
  })) as { id?: string };
  if (!creative.id) throw new Error(`adcreative returned no id: ${JSON.stringify(creative)}`);
  const ad = (await postForm(`${adAccount()}/ads`, {
    name: `auto-${args.name}`,
    adset_id: adSetId(),
    creative: JSON.stringify({ creative_id: creative.id }),
    status: "ACTIVE",
  })) as { id?: string };
  if (!ad.id) throw new Error(`ad returned no id: ${JSON.stringify(ad)}`);
  return ad.id;
}
