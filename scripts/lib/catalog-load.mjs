/**
 * Loads product data from lib/catalog.ts for the .mjs scripts. Node 23+ strips
 * TS types on import, so we import listProducts() directly; a regex fallback
 * keeps it working if type-stripping is unavailable.
 */
import { readFileSync } from "node:fs";

/**
 * Guardrail: blank-back mockups (camera_label containing "back", or Printify
 * camera id 98446) must never reach any creative/feed surface. Defense in depth
 * on top of gen-catalog.mjs already excluding them at generation time.
 */
function isBackImage(url) {
  const u = String(url);
  return /camera_label=[^&"']*back/i.test(u) || u.includes("/98446/");
}

/** Strip back images from every product's colors[].images (non-mutating). */
function stripBackImages(products) {
  return products.map((p) => ({
    ...p,
    colors: (p.colors || []).map((c) => {
      const images = (c.images || []).filter((u) => !isBackImage(u));
      const next = { ...c, images };
      if ("image" in next && isBackImage(next.image)) next.image = images[0] || "";
      return next;
    }),
  }));
}

export async function loadProducts() {
  try {
    const mod = await import(new URL("../../lib/catalog.ts", import.meta.url).href);
    if (typeof mod.listProducts === "function") {
      const list = mod.listProducts();
      if (Array.isArray(list) && list.length) return stripBackImages(list);
    }
  } catch {
    /* fall through to regex */
  }
  // Fallback: pull each product's id, name, priceCents, and its first color's
  // image URLs straight out of the source text.
  const src = readFileSync(new URL("../../lib/catalog.ts", import.meta.url), "utf8");
  const out = [];
  const blockRe = /"([a-z0-9-]+)":\s*\{\s*"name":\s*"([^"]+)"[\s\S]*?"priceCents":\s*(\d+)/g;
  let m;
  while ((m = blockRe.exec(src))) {
    const [, id, name, price] = m;
    // images from the slice of text following this product up to the next product key
    const rest = src.slice(m.index, blockRe.lastIndex + 4000);
    const imgs = [...rest.matchAll(/"(https:\/\/images-api\.printify\.com\/mockup\/[^"]+)"/g)]
      .map((x) => x[1])
      .filter((u) => !isBackImage(u));
    out.push({ id, name, priceCents: Number(price), colors: [{ images: imgs.slice(0, 6) }] });
  }
  if (!out.length) throw new Error("catalog-load: could not parse lib/catalog.ts");
  return out;
}
