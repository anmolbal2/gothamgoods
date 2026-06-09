"use client";

import { useState } from "react";
import { SIZE_ORDER, type Size } from "@/lib/catalog";

export default function BuyButton({
  productId,
  sizes,
}: {
  productId: string;
  sizes: Size[];
}) {
  const ordered = SIZE_ORDER.filter((s) => sizes.includes(s));
  const [size, setSize] = useState<Size>(ordered[0] ?? "M");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: [{ productId, size, qty: 1 }] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Checkout failed");
      }
      const { url } = await res.json();
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`size-${productId}`}
          className="text-sm font-medium text-muted"
        >
          Size
        </label>
        <select
          id={`size-${productId}`}
          data-testid="size-select"
          value={size}
          onChange={(e) => setSize(e.target.value as Size)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium focus:border-brand focus:outline-none"
        >
          {ordered.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={buy}
        disabled={loading}
        data-testid="buy-button"
        className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting…" : "Buy now"}
      </button>

      {error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
