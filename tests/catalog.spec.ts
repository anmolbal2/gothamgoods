import { test, expect } from "@playwright/test";
import { CATALOG, resolveLine, listProducts } from "../lib/catalog";

/**
 * Acceptance criterion #2: adding a product is a ONE-object edit to lib/catalog.ts.
 * Proven here by adding a throwaway object to CATALOG and showing that BOTH the
 * storefront source (listProducts) AND the purchase path (resolveLine — exactly
 * what app/api/checkout calls) immediately reflect it, with no other change.
 */
test("a single CATALOG object drives both the storefront list and the purchase path", () => {
  const id = "throwaway-tee";
  expect(listProducts().some((p) => p.id === id)).toBe(false);

  CATALOG[id] = {
    name: "Throwaway Tee",
    priceCents: 1234,
    image: "",
    printifyProductId: "PID_THROWAWAY",
    variants: { M: 999 },
  };

  try {
    // Storefront renders from listProducts()
    const listed = listProducts().find((p) => p.id === id);
    expect(listed?.name).toBe("Throwaway Tee");

    // Checkout prices + maps to Printify from resolveLine()
    const line = resolveLine(id, "M");
    expect(line.name).toBe("Throwaway Tee");
    expect(line.priceCents).toBe(1234);
    expect(line.item).toEqual({
      product_id: "PID_THROWAWAY",
      variant_id: 999,
      quantity: 1,
    });

    // Unknown size still throws (validation choke point)
    expect(() => resolveLine(id, "XXL")).toThrow();
  } finally {
    delete CATALOG[id];
  }

  expect(listProducts().some((p) => p.id === id)).toBe(false);
});
