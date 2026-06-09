/**
 * Series state + display formatters for the Knicks finals run.
 *
 * The live values are stored in Supabase and refreshed by the cron
 * (app/api/cron/refresh-series). This file holds the TYPES, a SEED fallback used
 * when the store is empty/unreachable, and PURE formatters that turn the raw
 * series facts into natural copy for every state (leads / trails / tied / won /
 * eliminated / no game). Pure functions only — safe to import in client + server.
 */

export interface NextGame {
  number?: number;
  homeAway: "vs" | "@";
  opponentName: string;
  tipoffISO: string;
  broadcast?: string;
}

export interface SeriesState {
  round: string; // e.g. "NBA Finals", "Eastern Conference Finals"
  teamAbbr: string; // "NYK"
  teamName: string; // "New York"
  opponentAbbr: string; // "SAS"
  opponentName: string; // "San Antonio"
  wins: number;
  losses: number;
  status: "in_progress" | "won" | "lost";
  nextGame: NextGame | null;
  updatedAt: string; // ISO
}

/** Fallback used when Supabase is empty/unreachable. The cron overwrites this. */
export const SEED_SERIES: SeriesState = {
  round: "NBA Finals",
  teamAbbr: "NYK",
  teamName: "New York",
  opponentAbbr: "SAS",
  opponentName: "San Antonio",
  wins: 2,
  losses: 1,
  status: "in_progress",
  nextGame: {
    number: 4,
    homeAway: "vs",
    opponentName: "San Antonio",
    tipoffISO: "2026-06-11T00:30:00Z",
    broadcast: "ABC",
  },
  updatedAt: "1970-01-01T00:00:00Z",
};

/** Bounds/shape check — used to reject bad scrapes and bad stored rows. */
export function isValidSeries(x: unknown): x is SeriesState {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  const okNum = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 4;
  if (typeof s.round !== "string" || !s.round) return false;
  if (typeof s.opponentName !== "string") return false;
  if (!okNum(s.wins) || !okNum(s.losses)) return false;
  if ((s.wins as number) + (s.losses as number) > 7) return false;
  if (!["in_progress", "won", "lost"].includes(s.status as string)) return false;
  const g = s.nextGame as Record<string, unknown> | null | undefined;
  if (g) {
    if (g.homeAway !== "vs" && g.homeAway !== "@") return false;
    if (typeof g.tipoffISO !== "string" || Number.isNaN(Date.parse(g.tipoffISO)))
      return false;
  }
  return true;
}

const EN = "–"; // en dash
const score = (a: number, b: number) => `${a}${EN}${b}`;

/** Short phrase for the hero eyebrow: "up 2–1" / "down 1–2" / "tied 2–2" / ... */
export function seriesPhrase(s: SeriesState): string {
  if (s.status === "won") return `wins ${score(s.wins, s.losses)}`;
  if (s.status === "lost") return `out ${score(s.wins, s.losses)}`;
  if (s.wins > s.losses) return `up ${score(s.wins, s.losses)}`;
  if (s.wins < s.losses) return `down ${score(s.wins, s.losses)}`;
  return `tied ${score(s.wins, s.losses)}`;
}

/** Full sentence for the tracker: "New York leads 2–1" / "Series tied 2–2" / ... */
export function leadLabel(s: SeriesState): string {
  if (s.status === "won") return `${s.teamName} wins the series ${score(s.wins, s.losses)}`;
  if (s.status === "lost") return `Eliminated ${score(s.wins, s.losses)}`;
  if (s.wins > s.losses) return `${s.teamName} leads ${score(s.wins, s.losses)}`;
  if (s.wins < s.losses) return `${s.teamName} trails ${score(s.losses, s.wins)}`;
  return `Series tied ${score(s.wins, s.losses)}`;
}

export function heroEyebrow(s: SeriesState): string {
  return `Back page · ${s.round} · ${s.teamName} ${seriesPhrase(s)}`;
}

function etParts(iso: string) {
  const d = new Date(iso);
  const tz = "America/New_York";
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(d); // "8:30 PM"
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
    .format(d)
    .toUpperCase(); // "WED"
  const dayKey = (x: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(x);
  return { time, weekday, isToday: dayKey(d) === dayKey(new Date()) };
}

/** "GAME 4 — TONIGHT 8:30 PM ET" or "GAME 4 — WED 8:30 PM ET" */
export function nextGameTicker(g: NextGame): string {
  const { time, weekday, isToday } = etParts(g.tipoffISO);
  const when = isToday ? "TONIGHT" : weekday;
  const num = g.number ? `GAME ${g.number}` : "NEXT GAME";
  return `${num} — ${when} ${time} ET`;
}

/** The marquee items: dynamic series line(s) + the static promo items. */
export function buildTickerItems(s: SeriesState): string[] {
  const items: string[] = [leadLabel(s).toUpperCase()];

  if (s.status === "in_progress" && s.nextGame) {
    items.push(nextGameTicker(s.nextGame));
  } else if (s.status === "won") {
    items.push(
      s.round.toLowerCase().includes("nba finals")
        ? "NBA CHAMPIONS 🏆"
        : `${s.teamName.toUpperCase()} ADVANCE`,
    );
  }

  items.push("FREE SHIPPING ON EVERY ORDER");
  items.push("THE FINALS DROP");
  items.push("SHIPPED FROM NEW JERSEY · 2–3 DAYS");
  return items;
}
