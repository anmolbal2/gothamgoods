"use client";

import { useEffect, useState } from "react";
import { SALE } from "@/lib/sale";

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
 * The Game-4 comeback sale strip: full-width orange banner between the hero and
 * the finals tracker. Countdown targets Game 5 tip-off (live from series state,
 * passed via endISO). Rendered only while SALE.active.
 */
export default function ComebackBanner({ endISO }: { endISO: string }) {
  // null until mounted — keeps server/client HTML identical (hydration-safe).
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMs(new Date(endISO).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endISO]);

  if (!SALE.active) return null;

  return (
    <section
      data-testid="comeback-banner"
      className="border-t-2 border-ink bg-orange text-ink"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-5 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="font-display text-3xl uppercase leading-none tracking-tight">
            {SALE.headline} 🏀
          </p>
          <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.25em]">
            {SALE.sub}
          </p>
        </div>

        <div className="text-center sm:text-right">
          <p className="font-display text-2xl uppercase leading-none tracking-tight">
            {SALE.pct}% off everything
          </p>
          <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-widest">
            {ms === null
              ? "Ends at Game 5 tip-off"
              : ms <= 0
                ? "Last call — sale ending"
                : `Ends at Game 5 tip-off · ${format(ms)}`}
          </p>
        </div>
      </div>
    </section>
  );
}
