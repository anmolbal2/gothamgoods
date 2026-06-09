#!/usr/bin/env node
/**
 * Zero-touch product discovery + AI marketing copy.
 *
 * Fetches every published product from the Printify shop, finds the ones not yet
 * represented in the storefront catalog (lib/catalog.ts) or the auto-store
 * (data/auto-products.json), and uses the Claude API to write each new product's
 * name / tagline / blurb in the Gotham Goods voice. New entries are appended to
 * data/auto-products.json.
 *
 * STANDALONE MODULE — by design it does NOT write lib/catalog.ts (that stays owned
 * by scripts/gen-catalog.mjs, which is being edited separately). Integration step,
 * once that settles: have gen-catalog.mjs merge data/auto-products.json into its
 * curated PRODUCTS list (curated entries win on id conflict) so these reach the
 * storefront + /api/feed/meta and Larven picks them up.
 *
 *   node --env-file=.env.local scripts/sync-products.mjs            # generate + write
 *   node --env-file=.env.local scripts/sync-products.mjs --dry-run  # list new only (no LLM, no write)
 *
 * Env: PRINTIFY_API_TOKEN, PRINTIFY_SHOP_ID, ANTHROPIC_API_KEY,
 *      ANTHROPIC_MODEL (optional, default claude-opus-4-6).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUTO_STORE = join(ROOT, "data", "auto-products.json");
const CATALOG_TS = join(ROOT, "lib", "catalog.ts");

const TOKEN = process.env.PRINTIFY_API_TOKEN;
const SHOP = process.env.PRINTIFY_SHOP_ID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-6";
const DRY = process.argv.includes("--dry-run");

if (!TOKEN || !SHOP) {
  console.error("Set PRINTIFY_API_TOKEN + PRINTIFY_SHOP_ID (use --env-file=.env.local locally).");
  process.exit(1);
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function printify(path) {
  const r = await fetch(`https://api.printify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`Printify ${r.status} for ${path}: ${await r.text()}`);
  return r.json();
}

/** All products in the shop (paginated). */
async function allProducts() {
  const out = [];
  for (let page = 1; ; page++) {
    const data = await printify(`/shops/${SHOP}/products.json?limit=50&page=${page}`);
    const items = Array.isArray(data) ? data : (data.data ?? []);
    out.push(...items);
    if (items.length < 50) break;
  }
  return out;
}

function loadStore() {
  if (existsSync(AUTO_STORE)) {
    try {
      const parsed = JSON.parse(readFileSync(AUTO_STORE, "utf8"));
      if (Array.isArray(parsed.products)) return parsed;
    } catch {
      /* fall through to empty */
    }
  }
  return { products: [] };
}

/** Printify ids already known to the storefront catalog or the auto-store. */
function knownState(store) {
  const ids = new Set();
  if (existsSync(CATALOG_TS)) {
    const txt = readFileSync(CATALOG_TS, "utf8");
    for (const m of txt.matchAll(/"printifyProductId":\s*"([^"]+)"/g)) ids.add(m[1]);
  }
  const takenKeys = new Set();
  for (const p of store.products) {
    ids.add(String(p.id));
    takenKeys.add(p.key);
  }
  return { ids, takenKeys };
}

function uniqueKey(base, taken) {
  const root = base || "product";
  let k = root;
  for (let i = 2; taken.has(k); i++) k = `${root}-${i}`;
  taken.add(k);
  return k;
}

/** Ask Claude to write the marketing copy for one product. Returns {name,tagline,blurb}. */
async function generateCopy(p) {
  const system =
    "You are the copywriter for Gotham Goods, a fast, irreverent New York sports/culture " +
    "fan-merch brand riding the Knicks' NBA finals run. Voice: punchy, confident, a little " +
    "cheeky, very NYC. The brand is fan-made and never claims NBA or team affiliation. " +
    "You write copy for a single t-shirt.";
  const user =
    "Write storefront copy for this shirt. Respond with STRICT JSON only — no markdown, no " +
    "text around it — matching exactly:\n" +
    '{"name":"<=40 chars, Title Case, ends with \\"Tee\\"","tagline":"<=22 chars, ALL CAPS eyebrow label","blurb":"1-2 sentences, <=160 chars, mention heavyweight Comfort Colors cotton and shipped from New Jersey"}\n\n' +
    `Printify product title: ${JSON.stringify(p.title || "")}\n` +
    `Printify product description: ${JSON.stringify(
      (p.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600),
    )}`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return parseCopy(text);
}

function parseCopy(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`no JSON in copy: ${text.slice(0, 120)}`);
  const o = JSON.parse(text.slice(start, end + 1));
  if (!o.name || !o.blurb) throw new Error(`copy missing fields: ${text.slice(0, 120)}`);
  return {
    name: String(o.name).trim().slice(0, 60),
    tagline: String(o.tagline || "").trim().toUpperCase().slice(0, 24),
    blurb: String(o.blurb).trim().slice(0, 200),
  };
}

async function main() {
  const products = await allProducts();
  const candidates = products.filter(
    (p) => p && p.visible !== false && (p.variants || []).some((v) => v.is_enabled),
  );
  const store = loadStore();
  const { ids, takenKeys } = knownState(store);
  const fresh = candidates.filter((p) => !ids.has(String(p.id)));

  console.error(
    `Printify: ${products.length} products, ${candidates.length} published, ${fresh.length} new.`,
  );

  if (fresh.length === 0) {
    console.error("Nothing new — catalog is up to date.");
    return;
  }

  if (DRY) {
    for (const p of fresh) console.error(`  NEW ${p.id}  ${JSON.stringify(p.title)}`);
    console.error("(dry run — no copy generated, nothing written)");
    return;
  }

  if (!ANTHROPIC_KEY) {
    console.error("ANTHROPIC_API_KEY not set — cannot generate copy. Set it or use --dry-run.");
    process.exit(1);
  }

  for (const p of fresh) {
    const copy = await generateCopy(p);
    const base = slug(copy.name.replace(/\btee\b/i, "")) || slug(p.title);
    const key = uniqueKey(base, takenKeys);
    store.products.push({
      id: String(p.id),
      key,
      ...copy,
      source: "llm",
      generatedAt: new Date().toISOString(),
    });
    console.error(`  + ${key}: ${copy.name} — ${copy.tagline}`);
  }

  if (!existsSync(dirname(AUTO_STORE))) mkdirSync(dirname(AUTO_STORE), { recursive: true });
  writeFileSync(AUTO_STORE, JSON.stringify(store, null, 2) + "\n");
  console.error(`\nWrote ${AUTO_STORE} (${store.products.length} auto products total).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
