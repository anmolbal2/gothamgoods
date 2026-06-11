"use client";

import { useCallback, useEffect, useState } from "react";
import { SALE } from "@/lib/sale";

const SEEN_KEY = "gg_sale_takeover_v1";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Full-screen comeback-sale takeover shown once per browser session when the
 * site is opened (sessionStorage-gated, so it never nags mid-session — e.g.
 * after backing out of Stripe to the cancel_url). Closes via ✕ / backdrop /
 * Esc; the CTA closes it and glides to the sale section.
 */
export default function SaleTakeover({ endISO }: { endISO: string }) {
  // Hidden until mounted (hydration-safe), then shown unless already seen.
  const [open, setOpen] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!SALE.active) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* storage blocked -> still show */
    }
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const tick = () => setMs(new Date(endISO).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearInterval(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, endISO, close]);

  function shopNow() {
    close();
    // Let the overlay unmount, then glide to the sale section.
    requestAnimationFrame(() => {
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comeback sale"
      data-testid="sale-takeover"
      onClick={close}
      className="gg-takeover fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-blue px-5 py-10 text-white"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white ring-1 ring-white/30 hover:bg-white/25"
      >
        ✕
      </button>

      <div
        className="mx-auto w-full max-w-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-orange">
          NBA Finals · Game 4 · The Comeback
        </p>

        <h2 className="mt-5 font-display uppercase leading-[0.9] tracking-tight">
          <span className="block text-[clamp(3.5rem,13vw,7rem)]">Down 29.</span>
          <span className="block text-[clamp(3.5rem,13vw,7rem)] text-orange">
            Won anyway.
          </span>
        </h2>

        <p className="mx-auto mt-6 max-w-md text-lg text-white/80">
          The Knicks erased a 29-point hole — so everything in the store is{" "}
          <span className="font-bold text-white">29% off</span>.
        </p>

        <p className="mt-6 flex items-baseline justify-center gap-3">
          <span className="font-mono text-2xl text-white/50 line-through">$49.99</span>
          <span className="font-display text-6xl text-orange">$35.49</span>
          <span className="font-mono text-sm font-bold uppercase tracking-widest text-white/80">
            every tee
          </span>
        </p>

        <p className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-white/70">
          {ms === null
            ? "Ends at Game 5 tip-off"
            : ms <= 0
              ? "Last call — sale ending"
              : `Ends at Game 5 tip-off · ${format(ms)}`}
        </p>

        <button
          type="button"
          data-testid="sale-takeover-cta"
          onClick={shopNow}
          className="mt-9 inline-block bg-orange px-10 py-4 font-mono text-base font-bold uppercase tracking-widest text-ink transition hover:bg-orange-bright"
        >
          Shop the comeback sale ↓
        </button>

        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-white/50">
          No code needed — prices already slashed
        </p>
      </div>
    </div>
  );
}
