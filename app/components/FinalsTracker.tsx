"use client";

import { useEffect, useState } from "react";
import { SERIES } from "@/lib/series";

function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0
    ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`
    : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function FinalsTracker() {
  // null until mounted -> avoids SSR/CSR hydration mismatch on the live clock.
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () =>
      setMs(new Date(SERIES.nextGame.tipoffISO).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const g = SERIES.nextGame;
  const live = ms !== null && ms <= 0 && ms > -3 * 3600 * 1000;
  const upcoming = ms !== null && ms > 0;

  return (
    <section className="border-y-2 border-ink bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-6 sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-orange">
            {SERIES.round} · Live
          </span>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-3xl">{SERIES.teamAbbr}</span>
            <span className="font-display text-3xl text-orange">{SERIES.wins}</span>
            <span className="font-mono text-base text-cream/40">–</span>
            <span className="font-display text-3xl text-orange">{SERIES.losses}</span>
            <span className="font-display text-3xl">{SERIES.opponentAbbr}</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-cream/60">
            {SERIES.leadLabel}
          </span>
        </div>

        <div className="text-center sm:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/50">
            Game {g.number} · {g.homeAway} {g.opponentName} · {g.broadcast}
          </p>
          <p className="font-display text-2xl">
            {ms === null ? (
              "—"
            ) : live ? (
              <span className="text-orange">● Live now</span>
            ) : upcoming ? (
              <>
                Tips off in <span className="text-orange">{format(ms)}</span>
              </>
            ) : (
              "Series continues"
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
