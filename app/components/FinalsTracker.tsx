"use client";

import { useEffect, useState } from "react";
import { leadLabel, type SeriesState } from "@/lib/series";

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

export default function FinalsTracker({ state }: { state: SeriesState }) {
  const g = state.nextGame;
  const tip = g?.tipoffISO;

  // null until mounted -> avoids SSR/CSR hydration mismatch on the live clock.
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!tip) return;
    const tick = () => setMs(new Date(tip).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tip]);

  const live = ms !== null && ms <= 0 && ms > -3 * 3600 * 1000;
  const upcoming = ms !== null && ms > 0;
  const isFinals = state.round.toLowerCase().includes("nba finals");

  let headline: React.ReactNode;
  if (state.status === "won") {
    headline = (
      <span className="text-orange">{isFinals ? "🏆 NBA Champions" : `🏆 ${state.teamName} advance`}</span>
    );
  } else if (state.status === "lost") {
    headline = "Season over";
  } else if (!g) {
    headline = "Next game TBD";
  } else if (ms === null) {
    headline = "—";
  } else if (live) {
    headline = <span className="text-orange">● Live now</span>;
  } else if (upcoming) {
    headline = (
      <>
        Tips off in <span className="text-orange">{format(ms)}</span>
      </>
    );
  } else {
    headline = "Series continues";
  }

  return (
    <section className="border-y-2 border-ink bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-6 sm:flex-row sm:justify-between">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-orange">
            {state.round} · Live
          </span>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-3xl">{state.teamAbbr}</span>
            <span className="font-display text-3xl text-orange">{state.wins}</span>
            <span className="font-mono text-base text-cream/40">–</span>
            <span className="font-display text-3xl text-orange">{state.losses}</span>
            <span className="font-display text-3xl">{state.opponentAbbr}</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-cream/60">
            {leadLabel(state)}
          </span>
        </div>

        <div className="text-center sm:text-right">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-cream/50">
            {g
              ? `${g.number ? `Game ${g.number} · ` : ""}${g.homeAway} ${g.opponentName}${
                  g.broadcast ? ` · ${g.broadcast}` : ""
                }`
              : state.round}
          </p>
          <p className="font-display text-2xl">{headline}</p>
        </div>
      </div>
    </section>
  );
}
