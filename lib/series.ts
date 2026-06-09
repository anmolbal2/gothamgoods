/**
 * Finals-run config that powers the ticker + live tracker.
 * This is the ONE place to update the series state — edit it as games happen.
 * (The countdown to tip-off is computed live in the browser from `tipoffISO`.)
 */

export interface NextGame {
  number: number;
  /** "vs" for home, "@" for away. */
  homeAway: "vs" | "@";
  opponentName: string;
  /** ISO 8601 with timezone offset, e.g. 2026-06-09T20:00:00-04:00 */
  tipoffISO: string;
  broadcast: string;
}

export const SERIES = {
  round: "NBA Finals",
  teamAbbr: "NYK",
  teamName: "New York",
  opponentAbbr: "IND",
  opponentName: "Indiana",
  wins: 2,
  losses: 0,
  leadLabel: "New York leads 2–0",
  nextGame: {
    number: 3,
    homeAway: "@",
    opponentName: "Indiana",
    // Game 3 — tonight, 8:00 PM ET.
    tipoffISO: "2026-06-09T20:00:00-04:00",
    broadcast: "ABC",
  } as NextGame,
  tickerItems: [
    "NEW YORK LEADS 2–0",
    "GAME 3 — TONIGHT 8:00 ET",
    "THE FINALS DROP",
    "PRINTED + SHIPPED FROM NEW JERSEY",
    "2–3 DAY DELIVERY",
  ],
};
