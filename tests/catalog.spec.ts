import { test, expect } from "@playwright/test";
import { CATALOG, resolveLine, listProducts, type Size } from "../lib/catalog";

/**
 * One CATALOG object (product -> colors -> sizes) drives both the storefront list
 * and the purchase path (resolveLine — exactly what app/api/checkout calls).
 */
test("a single CATALOG object with colors drives list + purchase path", () => {
  const id = "throwaway-tee";
  expect(listProducts().some((p) => p.id === id)).toBe(false);

  CATALOG[id] = {
    name: "Throwaway Tee",
    priceCents: 1234,
    tagline: "TEST",
    printifyProductId: "PID_X",
    colors: [
      { name: "Black", swatch: "#000", images: ["a.jpg", "b.jpg"], variants: { M: 999, L: 1000 } },
      { name: "White", swatch: "#fff", images: ["c.jpg"], variants: { M: 888 } },
    ],
  };

  try {
    expect(listProducts().find((p) => p.id === id)?.colors.length).toBe(2);

    const line = resolveLine(id, "Black", "M");
    expect(line.priceCents).toBe(1234);
    expect(line.item).toEqual({ product_id: "PID_X", variant_id: 999, quantity: 1 });
    expect(line.name).toContain("Black");
    expect(resolveLine(id, "White", "M").item.variant_id).toBe(888);

    expect(() => resolveLine(id, "Purple", "M")).toThrow(); // unknown color
    expect(() => resolveLine(id, "White", "L")).toThrow(); // color lacks that size
  } finally {
    delete CATALOG[id];
  }
  expect(listProducts().some((p) => p.id === id)).toBe(false);
});

test("real catalog: 3 products, each with colors + resolvable variants", () => {
  const ps = listProducts();
  expect(ps.length).toBeGreaterThanOrEqual(3);
  for (const p of ps) {
    expect(p.colors.length).toBeGreaterThan(0);
    const c = p.colors[0];
    expect(c.images.length).toBeGreaterThan(0); // carousel needs >=1 photo
    const sizes = Object.keys(c.variants) as Size[];
    expect(sizes.length).toBeGreaterThan(0);
    const line = resolveLine(p.id, c.name, sizes[0]);
    expect(line.item.variant_id).toBe(c.variants[sizes[0]]);
    expect(line.priceCents).toBe(p.priceCents);
  }
});

test("comeback sale: every product is exactly 29% off list, charged at the sale price", () => {
  const ps = listProducts().filter((p) => p.compareAtCents !== undefined);
  test.skip(ps.length === 0, "no sale running");
  for (const p of ps) {
    expect(p.compareAtCents!).toBeGreaterThan(p.priceCents); // anchor above charged
    expect(Math.round((1 - p.priceCents / p.compareAtCents!) * 100)).toBe(29);
    // resolveLine (what checkout charges) uses the SALE price, never the anchor.
    const c = p.colors[0];
    const size = Object.keys(c.variants)[0] as Size;
    expect(resolveLine(p.id, c.name, size).priceCents).toBe(p.priceCents);
  }
});
