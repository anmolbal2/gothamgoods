#!/usr/bin/env node
/**
 * One-time helper. Prints your Printify shop id, each published product's id,
 * the enabled variant ids per size, and a mockup image URL — formatted so you can
 * paste a ready-made object into lib/catalog.ts.
 *
 * Usage:
 *   node --env-file=.env.local scripts/fetch-catalog.mjs
 */

const TOKEN = process.env.PRINTIFY_API_TOKEN;
const BASE = process.env.PRINTIFY_API_BASE || "https://api.printify.com/v1";

if (!TOKEN) {
  console.error(
    "PRINTIFY_API_TOKEN is not set.\n" +
      "Run with:  node --env-file=.env.local scripts/fetch-catalog.mjs",
  );
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}` };

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function guessSize(title) {
  const m = String(title).match(/\b(XS|S|M|L|XL|XXL|2XL|3XL)\b/i);
  return m ? m[1].toUpperCase().replace("2XL", "XXL") : "?";
}

async function main() {
  const shops = await getJson("/shops.json");
  console.log("\n=== Shops ===");
  for (const s of shops) {
    console.log(`  id=${s.id}  title=${JSON.stringify(s.title)}  channel=${s.sales_channel}`);
  }

  let shopId = process.env.PRINTIFY_SHOP_ID || shops[0]?.id;
  if (!shopId) {
    console.error("No shop found.");
    process.exit(1);
  }
  console.log(`\nUsing shop id=${shopId}\n`);

  const data = await getJson(`/shops/${shopId}/products.json`);
  const products = data.data ?? data;

  console.log("=== Paste these into CATALOG in lib/catalog.ts ===\n");
  for (const p of products) {
    const enabled = (p.variants ?? []).filter((v) => v.is_enabled);
    const mockup = (p.images?.find((i) => i.is_default) ?? p.images?.[0])?.src ?? "";

    console.log(`  "${slug(p.title)}": {`);
    console.log(`    name: ${JSON.stringify(p.title)},`);
    console.log(`    priceCents: 3400, // TODO set your retail price`);
    console.log(`    image: ${JSON.stringify(mockup)},`);
    console.log(`    printifyProductId: ${JSON.stringify(String(p.id))},`);
    console.log(`    variants: {`);
    for (const v of enabled) {
      console.log(`      // ${v.title}`);
      console.log(`      ${guessSize(v.title)}: ${v.id},`);
    }
    console.log(`    },`);
    console.log(`  },\n`);
  }

  console.log("Tip: double-check the size -> variant mapping against the variant titles above.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
