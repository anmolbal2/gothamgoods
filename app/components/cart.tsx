"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CATALOG, SIZE_ORDER, type Size } from "@/lib/catalog";

export interface CartItem {
  productId: string;
  size: Size;
  qty: number;
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (productId: string, size: Size) => void;
  setQty: (productId: string, size: Size, qty: number) => void;
  remove: (productId: string, size: Size) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  checkout: () => Promise<void>;
  checkingOut: boolean;
  error: string | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gg_cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("gg_cart", JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((productId: string, size: Size) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.productId === productId && x.size === size);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(10, next[i].qty + 1) };
        return next;
      }
      return [...prev, { productId, size, qty: 1 }];
    });
    setError(null);
    setOpen(true);
  }, []);

  const setQty = useCallback((productId: string, size: Size, qty: number) => {
    setItems((prev) =>
      prev
        .map((x) =>
          x.productId === productId && x.size === size
            ? { ...x, qty: Math.max(0, Math.min(10, qty)) }
            : x,
        )
        .filter((x) => x.qty > 0),
    );
  }, []);

  const remove = useCallback((productId: string, size: Size) => {
    setItems((prev) =>
      prev.filter((x) => !(x.productId === productId && x.size === size)),
    );
  }, []);

  const subtotalCents = items.reduce(
    (sum, it) => sum + (CATALOG[it.productId]?.priceCents ?? 0) * it.qty,
    0,
  );
  const count = items.reduce((sum, it) => sum + it.qty, 0);

  const checkout = useCallback(async () => {
    if (items.length === 0) return;
    setCheckingOut(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cart: items }),
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
      setCheckingOut(false);
    }
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        count,
        subtotalCents,
        add,
        setQty,
        remove,
        open,
        setOpen,
        checkout,
        checkingOut,
        error,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function CartButton() {
  const { count, setOpen } = useCart();
  return (
    <button
      type="button"
      data-testid="cart-button"
      onClick={() => setOpen(true)}
      className="bg-ink px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-cream transition hover:bg-blue"
    >
      Cart ({count})
    </button>
  );
}

export function AddToCart({
  productId,
  sizes,
  priceCents,
  variant = "card",
}: {
  productId: string;
  sizes: Size[];
  priceCents: number;
  variant?: "hero" | "card";
}) {
  const { add } = useCart();
  const ordered = SIZE_ORDER.filter((s) => sizes.includes(s));
  const [size, setSize] = useState<Size>(
    ordered.includes("M") ? "M" : ordered[0] ?? "M",
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ordered.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            aria-pressed={s === size}
            className={`min-w-11 border-2 px-3 py-2 font-mono text-sm font-bold uppercase transition ${
              s === size
                ? "border-orange bg-orange text-ink"
                : variant === "hero"
                  ? "border-white/30 text-white hover:border-white"
                  : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-testid="add-to-cart"
        onClick={() => add(productId, size)}
        className="w-full bg-orange px-5 py-3.5 font-mono text-sm font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright"
      >
        Add to cart — {money(priceCents)}
      </button>
    </div>
  );
}

export function CartDrawer() {
  const {
    items,
    open,
    setOpen,
    subtotalCents,
    setQty,
    remove,
    checkout,
    checkingOut,
    error,
  } = useCart();

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-ink/60 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Cart"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4">
          <h2 className="font-display text-xl uppercase tracking-tight">Your cart</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-xs uppercase tracking-widest text-ink/60 hover:text-ink"
          >
            Close ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="mt-10 text-center font-mono text-sm uppercase tracking-widest text-ink/50">
              Your cart is empty
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {items.map((it) => {
                const p = CATALOG[it.productId];
                if (!p) return null;
                return (
                  <li
                    key={`${it.productId}-${it.size}`}
                    className="flex items-start justify-between gap-3 border-b border-line pb-4"
                  >
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="font-mono text-xs uppercase tracking-widest text-ink/50">
                        Size {it.size}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setQty(it.productId, it.size, it.qty - 1)}
                          className="h-7 w-7 border border-ink/30 font-mono leading-none hover:border-ink"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-mono text-sm">{it.qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(it.productId, it.size, it.qty + 1)}
                          className="h-7 w-7 border border-ink/30 font-mono leading-none hover:border-ink"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{money(p.priceCents * it.qty)}</p>
                      <button
                        type="button"
                        onClick={() => remove(it.productId, it.size)}
                        className="mt-2 font-mono text-[11px] uppercase tracking-widest text-ink/40 hover:text-orange"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t-2 border-ink px-5 py-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/60">
              Subtotal
            </span>
            <span className="font-display text-2xl">{money(subtotalCents)}</span>
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-ink/60">
              Shipping
            </span>
            <span className="font-mono text-sm font-bold uppercase tracking-widest text-orange">
              Free
            </span>
          </div>
          {error && (
            <p className="mb-3 font-mono text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            data-testid="cart-checkout"
            onClick={checkout}
            disabled={items.length === 0 || checkingOut}
            className="w-full bg-orange px-5 py-4 font-mono text-sm font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkingOut ? "Redirecting…" : "Checkout"}
          </button>
          <p className="mt-2 text-center font-mono text-[11px] uppercase tracking-widest text-ink/40">
            🔒 Secure checkout by Stripe
          </p>
        </div>
      </aside>
    </>
  );
}
