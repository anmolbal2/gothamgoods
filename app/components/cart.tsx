"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CATALOG } from "@/lib/catalog";
import type { Size } from "@/lib/catalog";

export interface CartItem {
  productId: string;
  colorName: string;
  size: Size;
  qty: number;
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
const keyOf = (p: string, c: string, s: string) => `${p}__${c}__${s}`;

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  add: (productId: string, colorName: string, size: Size) => void;
  setQty: (productId: string, colorName: string, size: Size, qty: number) => void;
  remove: (productId: string, colorName: string, size: Size) => void;
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
      const saved = localStorage.getItem("gg_cart_v2");
      if (saved) setItems(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("gg_cart_v2", JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((productId: string, colorName: string, size: Size) => {
    setItems((prev) => {
      const k = keyOf(productId, colorName, size);
      const i = prev.findIndex((x) => keyOf(x.productId, x.colorName, x.size) === k);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(10, next[i].qty + 1) };
        return next;
      }
      return [...prev, { productId, colorName, size, qty: 1 }];
    });
    setError(null);
    setOpen(true);
  }, []);

  const setQty = useCallback(
    (productId: string, colorName: string, size: Size, qty: number) => {
      const k = keyOf(productId, colorName, size);
      setItems((prev) =>
        prev
          .map((x) =>
            keyOf(x.productId, x.colorName, x.size) === k
              ? { ...x, qty: Math.max(0, Math.min(10, qty)) }
              : x,
          )
          .filter((x) => x.qty > 0),
      );
    },
    [],
  );

  const remove = useCallback((productId: string, colorName: string, size: Size) => {
    const k = keyOf(productId, colorName, size);
    setItems((prev) => prev.filter((x) => keyOf(x.productId, x.colorName, x.size) !== k));
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
                    key={keyOf(it.productId, it.colorName, it.size)}
                    className="flex items-start justify-between gap-3 border-b border-line pb-4"
                  >
                    <div>
                      <p className="font-bold">{p.name}</p>
                      <p className="font-mono text-xs uppercase tracking-widest text-ink/50">
                        {it.colorName} · {it.size}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() =>
                            setQty(it.productId, it.colorName, it.size, it.qty - 1)
                          }
                          className="h-7 w-7 border border-ink/30 font-mono leading-none hover:border-ink"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-mono text-sm">{it.qty}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() =>
                            setQty(it.productId, it.colorName, it.size, it.qty + 1)
                          }
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
                        onClick={() => remove(it.productId, it.colorName, it.size)}
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
