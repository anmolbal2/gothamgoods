#!/usr/bin/env node
/**
 * Generates lib/catalog.ts from the live Printify shop — products x colors x sizes.
 * Curated metadata (names/blurbs/price/swatches/order) lives here; variant ids +
 * mockup images come from Printify. Re-run after Printify changes:
 *   node --env-file=.env.local scripts/gen-catalog.mjs
 */
import { writeFileSync } from "node:fs";

const TOKEN = process.env.PRINTIFY_API_TOKEN;
const SHOP = process.env.PRINTIFY_SHOP_ID;
if (!TOKEN || !SHOP) {
  console.error("Set PRINTIFY_API_TOKEN + PRINTIFY_SHOP_ID (use --env-file=.env.local)");
  process.exit(1);
}

// PRICING — flat regular price, no sale. (The 2026-06 comeback sale ended when the
// Knicks won the title; the sale UI/infra was removed. To run a future sale you'd
// re-introduce a compareAtCents anchor + the sale components.) PRICE_CENTS is what's
// charged everywhere (cart/Stripe/pixels/feeds).
const PRICE_CENTS = 3999; // regular price $39.99
const COMPARE_AT_CENTS = 0; // no anchor/strikethrough
const SALE_PCT = 0;

// Curated product metadata, in display order.
// Each product gets a LARGELY DIFFERENT set of Printify stock mockups (different
// models/poses), so the lineup looks varied — not the same shots on 3 designs.
// `views` = ordered camera_labels (front first; no backs). All exist per color.
const PRODUCTS = [
  {
    id: "6a27897a8f2246d09f0acb65",
    key: "knicks-in-four",
    name: "Knicks in Four Tee",
    tagline: "MY MAYOR MUSLIM",
    blurb:
      "The whole city is saying it, so we put it on a shirt. Heavyweight Comfort Colors cotton, shipped from New Jersey.",
    views: ["front", "person-1-front", "person-3-front", "person-3-context"],
    defaultColor: "Black",
  },
  {
    // HEADLINER — featured in the hero (see app/page.tsx).
    id: "6a2d9a0173ad2eacae0ee154",
    key: "popes-on-our-side",
    name: "Pope's on Our Side Tee",
    tagline: "POPE'S ON OUR SIDE",
    blurb:
      "My Mayor Muslim, my bagels Jewish, the Pope's on our side — divine intervention says Knicks in 5. Soft cotton tee, shipped free from New Jersey in 2–3 days.",
    views: ["front", "person-1-front", "person-2-front", "lifestyle"],
    defaultColor: "White",
  },
  {
    id: "6a2d9b4064e16026a6060e28",
    key: "saturday-night-live",
    name: "Saturday Night Live Tee",
    tagline: "MY SATURDAY NIGHT LIVE",
    blurb:
      "My Mayor Muslim, my bagels Jewish, my Saturday Night Live — the full New York starter pack, Knicks in 5. Soft cotton tee, shipped free from New Jersey in 2–3 days.",
    views: ["front", "person-1-front", "person-2-front", "lifestyle"],
    defaultColor: "Royal",
  },
  {
    id: "6a29fb43b68139813c06d632",
    key: "knicks-in-five",
    name: "Knicks in Five Tee",
    tagline: "TRUMP KILLED THE VIBES",
    blurb:
      "The whole bit, updated for Game 5 — My Mayor Muslim, My Bagels Jewish, and Trump killed the vibes. Soft cotton tee, shipped free from New Jersey in 2–3 days.",
    views: ["front", "person-1-front", "person-2-front", "lifestyle"],
    defaultColor: "Black",
  },
  {
    id: "6a29fcb2fe6ec8a6d110b144",
    key: "cream-cheese-chive",
    name: "Cream Cheese Chive Tee",
    tagline: "MY CREAM CHEESE CHIVE",
    blurb:
      "My Mayor Muslim, my bagels Jewish, my cream cheese chive — the full New York order, Knicks in 5. Soft cotton tee, shipped free from New Jersey in 2–3 days.",
    views: ["front", "person-1-front", "person-2-front", "lifestyle"],
    defaultColor: "Ice Grey",
  },
  {
    id: "6a27c36891cf9037720216b7",
    key: "better-than-brunson",
    name: "Better Than Brunson Tee",
    tagline: "CAPTAIN CLUTCH",
    blurb:
      "Everyone's better than Jalen Brunson — until it's time to be better than Jalen Brunson. For the doubters and the believers.",
    views: ["front", "person-2", "person-4-front", "person-4-context"],
    defaultColor: "Grey",
  },
  {
    id: "6a27c372cf9078f4a3052270",
    key: "corgi-wrong",
    name: "Corgi's Gonna Be Wrong Tee",
    tagline: "FADE THE CORGI",
    blurb:
      "The corgi's gonna be wrongggg. For everyone who fades the playoff pet picks and rides with New York.",
    views: ["front", "person-5-context", "person-5-context-2", "folded"],
    defaultColor: "Black",
  },
  {
    id: "6a27dd8575aae553c70ecf64",
    key: "he-is-my-everything",
    name: "He Is My Everything Tee",
    tagline: "HE IS MY FATHER",
    blurb:
      "Doctor, engineer, pastor, father — he's the whole résumé, and we only needed him to hit the corner three. Heavyweight Comfort Colors cotton, shipped fresh out of New Jersey.",
    views: ["front", "person-1-front", "person-2", "person-5-context"],
    defaultColor: "Grey",
  },
];

// Swatch hexes + color display order.
const SWATCH = {
  White: "#efece2",
  Black: "#1c1c1c",
  Royal: "#1c4d92",
  Orange: "#e3592a",
  Charcoal: "#565459",
  Graphite: "#4f5356",
  Pepper: "#575450",
  "Ice Grey": "#cfcecc",
  Grey: "#b9bbbb",
  Granite: "#9b9a94",
  "Mystic Blue": "#5f7e93",
};
const COLOR_ORDER = ["White", "Black", "Royal", "Orange", "Charcoal", "Graphite", "Pepper", "Ice Grey", "Grey", "Granite", "Mystic Blue"];
const SIZE_ALIAS = { "2XL": "XXL" };
// 4XL is intentionally omitted — we don't offer it (it left the size grid with a
// lone button on its own row). Variants for it are dropped in buildColors below.
const SIZE_ORDER = ["S", "M", "L", "XL", "XXL", "3XL"];

async function getProduct(id) {
  const r = await fetch(`https://api.printify.com/v1/shops/${SHOP}/products/${id}.json`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`Printify ${r.status} for ${id}`);
  return r.json();
}

// Default ordered views (used if a product doesn't define its own `views`).
// No "back" view (the design is front-only, so backs add nothing).
const DEFAULT_VIEWS = [
  "front",
  "person-1-front",
  "person-3-front",
  "person-4-context",
  "person-5-context",
];
// NO BACK VIEWS: the "back" mockups (camera_label *back*, camera id 98446) are
// blank shirts and must never appear on any site/feed/creative surface.
// isBackImage() below is the single source of truth for that exclusion.
const EXCLUDE = new Set(["size-chart"]);

function cameraLabel(src) {
  try {
    return new URL(src).searchParams.get("camera_label") || "";
  } catch {
    return "";
  }
}

/** Blank-back guardrail: any back-ish camera label or the 98446 camera id. */
function isBackImage(label, src) {
  return String(label).toLowerCase().includes("back") || String(src).includes("/98446/");
}

function buildColors(p, views = DEFAULT_VIEWS, defaultColor) {
  const enabled = (p.variants || []).filter((v) => v.is_enabled);
  const byColor = {};
  for (const v of enabled) {
    const [color, rawSize] = (v.title || "").split(" / ");
    const size = SIZE_ALIAS[rawSize] || rawSize;
    if (!SIZE_ORDER.includes(size)) continue; // skip sizes we don't offer (e.g. 4XL)
    (byColor[color] ??= {})[size] = v.id;
  }
  const colors = [];
  for (const color of COLOR_ORDER) {
    const variants = byColor[color];
    if (!variants) continue;
    const ids = new Set(Object.values(variants));

    // First src per camera_label for images that belong to this color (skip junk).
    const byLabel = {};
    for (const im of p.images || []) {
      if (!(im.variant_ids || []).some((id) => ids.has(id))) continue;
      const label = cameraLabel(im.src);
      if (EXCLUDE.has(label) || isBackImage(label, im.src)) continue;
      if (!(label in byLabel)) byLabel[label] = im.src;
    }

    // This product's views (in order); fall back to any remaining if fewer than 2.
    // The fallback must never promote a back view (blank shirt) into images[].
    let images = views.filter((l) => byLabel[l]).map((l) => byLabel[l]);
    if (images.length < 2) {
      const rest = Object.entries(byLabel)
        .filter(([l, src]) => !views.includes(l) && !isBackImage(l, src))
        .map(([, src]) => src);
      images = [...images, ...rest];
    }
    images = [...new Set(images)].slice(0, 6);

    colors.push({
      name: color,
      swatch: SWATCH[color] || "#888888",
      images,
      image: images[0] || "",
      variants,
    });
  }
  // Default colorway shown on the card/hero = colors[0]. Move the chosen default to
  // the front so the storefront rotates colors (variety across the grid).
  if (defaultColor) {
    const i = colors.findIndex((c) => c.name === defaultColor);
    if (i > 0) colors.unshift(colors.splice(i, 1)[0]);
  }
  return colors;
}

const catalog = {};
for (const meta of PRODUCTS) {
  const p = await getProduct(meta.id);
  catalog[meta.key] = {
    name: meta.name,
    priceCents: PRICE_CENTS,
    // After priceCents on purpose: scripts/lib/catalog-load.mjs regex-parses this file.
    ...(SALE_PCT > 0 ? { compareAtCents: COMPARE_AT_CENTS } : {}),
    tagline: meta.tagline,
    blurb: meta.blurb,
    printifyProductId: meta.id,
    colors: buildColors(p, meta.views, meta.defaultColor),
  };
  const totalVariants = catalog[meta.key].colors.reduce(
    (n, c) => n + Object.keys(c.variants).length,
    0,
  );
  console.error(
    `  ${meta.key}: ${catalog[meta.key].colors.length} colors, ${totalVariants} variants`,
  );
}

const header = `// AUTO-GENERATED by scripts/gen-catalog.mjs from the Printify shop.
// Editable, but re-running the script overwrites it with fresh variant ids + mockups.
//
// SINGLE SOURCE OF TRUTH: products -> colors -> sizes -> Printify variant ids.

export type Size = ${SIZE_ORDER.map((s) => JSON.stringify(s)).join(" | ")};
export const SIZE_ORDER: Size[] = ${JSON.stringify(SIZE_ORDER)};

export interface ColorVariant {
  name: string;
  swatch: string; // hex for the picker
  images: string[]; // ordered mockups: front, on-person, lifestyle — back views excluded (blank shirts)
  image?: string; // legacy first image (hero/feed compat) = images[0]
  variants: Partial<Record<Size, number>>; // size -> Printify variant id
}

export interface Product {
  name: string;
  priceCents: number; // the CHARGED price (sale price while a sale is active)
  compareAtCents?: number; // anchor/list price for display only — never charged
  tagline?: string;
  blurb?: string;
  printifyProductId: string;
  colors: ColorVariant[];
}

export const CATALOG: Record<string, Product> = ${JSON.stringify(catalog, null, 2)};

export interface ResolvedLine {
  name: string;
  priceCents: number;
  item: { product_id: string; variant_id: number; quantity: 1 };
}

/** Resolve { productId, color, size } to a priced line + Printify item. Throws on any miss. */
export function resolveLine(productId: string, color: string, size: Size): ResolvedLine {
  const product = CATALOG[productId];
  if (!product) throw new Error(\`Unknown product: \${productId}\`);
  const c = product.colors.find((x) => x.name === color);
  if (!c) throw new Error(\`Unknown color \${color} for \${productId}\`);
  const variant_id = c.variants[size];
  if (variant_id === undefined) throw new Error(\`Unknown size \${size} for \${productId} / \${color}\`);
  return {
    name: \`\${product.name} — \${color} / \${size}\`,
    priceCents: product.priceCents,
    item: { product_id: product.printifyProductId, variant_id, quantity: 1 },
  };
}

export function listProducts(): Array<Product & { id: string }> {
  return Object.entries(CATALOG).map(([id, product]) => ({ id, ...product }));
}
`;

writeFileSync(new URL("../lib/catalog.ts", import.meta.url), header);
console.error("\nWrote lib/catalog.ts");
