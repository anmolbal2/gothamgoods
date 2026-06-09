/**
 * SINGLE SOURCE OF TRUTH for the storefront.
 *
 * Adding a product = adding ONE object to CATALOG. Nothing else in the codebase
 * needs to change: the storefront grid, server-side pricing, and the Printify
 * variant mapping all derive from this file.
 *
 * Get real `printifyProductId` / `variants` / mockup `image` values for a new
 * product by running:  node --env-file=.env.local scripts/fetch-catalog.mjs
 */

export type Size = "S" | "M" | "L" | "XL" | "XXL";

export interface Product {
  /** Display name, also used as the Stripe line-item name. */
  name: string;
  /** Price in cents. Authoritative — the browser never sends prices. */
  priceCents: number;
  /** Mockup image URL (real Printify CDN url, or "" to render a branded placeholder tile). */
  image: string;
  /** Short marketing blurb shown on the card. */
  blurb?: string;
  /** Published Printify product id. */
  printifyProductId: string;
  /** Map of size -> Printify variant id. */
  variants: Partial<Record<Size, number>>;
}

export const CATALOG: Record<string, Product> = {
  // Real published product in the GothamGoods Printify shop (id 27855301),
  // pulled via scripts/fetch-catalog.mjs. Add more products by appending objects.
  "gotham-garment-dyed-tee": {
    name: "Gotham Goods Garment-Dyed Tee",
    priceCents: 3400, // $34.00 — adjust to your retail price
    image: "", // no Printify mockup generated yet -> branded placeholder tile renders
    blurb: "Premium garment-dyed heavyweight cotton. Lived-in softness, vintage wash.",
    printifyProductId: "6a27897a8f2246d09f0acb65",
    variants: { S: 73199, M: 73203, L: 73207, XL: 73211, XXL: 73215 },
  },
};

export const SIZE_ORDER: Size[] = ["S", "M", "L", "XL", "XXL"];

export interface ResolvedLine {
  name: string;
  priceCents: number;
  item: { product_id: string; variant_id: number; quantity: 1 };
}

/**
 * Resolve a { productId, size } selection to a priced line + the Printify item.
 * Throws on unknown product or size — the checkout route's try/catch turns these
 * into a 400 so a malformed browser request can never produce a bad order.
 */
export function resolveLine(productId: string, size: Size): ResolvedLine {
  const product = CATALOG[productId];
  if (!product) throw new Error(`Unknown product: ${productId}`);

  const variant_id = product.variants[size];
  if (variant_id === undefined) {
    throw new Error(`Unknown size ${size} for ${productId}`);
  }

  return {
    name: product.name,
    priceCents: product.priceCents,
    item: { product_id: product.printifyProductId, variant_id, quantity: 1 },
  };
}

/** Helper for the storefront: the catalog as an array with its id attached. */
export function listProducts(): Array<Product & { id: string }> {
  return Object.entries(CATALOG).map(([id, product]) => ({ id, ...product }));
}
