import { test, expect } from "@playwright/test";
import {
  leadLabel,
  seriesPhrase,
  heroEyebrow,
  buildTickerItems,
  isValidSeries,
  type SeriesState,
} from "../lib/series";

const base: SeriesState = {
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
    tipoffISO: "2030-06-11T00:30:00Z",
    broadcast: "ABC",
  },
  updatedAt: "1970-01-01T00:00:00Z",
};
const mk = (p: Partial<SeriesState>): SeriesState => ({ ...base, ...p });

test("leadLabel + seriesPhrase read naturally in every state", () => {
  expect(leadLabel(mk({ wins: 2, losses: 1 }))).toBe("New York leads 2–1");
  expect(seriesPhrase(mk({ wins: 2, losses: 1 }))).toBe("up 2–1");

  expect(leadLabel(mk({ wins: 1, losses: 2 }))).toBe("New York trails 2–1");
  expect(seriesPhrase(mk({ wins: 1, losses: 2 }))).toBe("down 1–2");

  expect(leadLabel(mk({ wins: 2, losses: 2 }))).toBe("Series tied 2–2");
  expect(seriesPhrase(mk({ wins: 2, losses: 2 }))).toBe("tied 2–2");

  expect(leadLabel(mk({ wins: 4, losses: 1, status: "won" }))).toBe(
    "New York wins the series 4–1",
  );
  expect(leadLabel(mk({ wins: 2, losses: 4, status: "lost" }))).toBe("Eliminated 2–4");
});

test("heroEyebrow includes the live round + phrase", () => {
  expect(heroEyebrow(mk({ wins: 2, losses: 1 }))).toBe(
    "Back page · NBA Finals · New York up 2–1",
  );
});

test("buildTickerItems: in-progress shows lead + next game + promo", () => {
  const items = buildTickerItems(mk({}));
  expect(items[0]).toBe("NEW YORK LEADS 2–1");
  expect(items.some((i) => /^GAME 4 — .*ET$/.test(i))).toBe(true);
  expect(items).toContain("FREE SHIPPING ON EVERY ORDER");
  expect(items).toContain("NEW DROP EVERY DAY");
});

test("buildTickerItems: series won (Finals) shows champions, no game line", () => {
  const items = buildTickerItems(mk({ wins: 4, losses: 1, status: "won", nextGame: null }));
  expect(items[0]).toBe("NEW YORK WINS THE SERIES 4–1");
  expect(items).toContain("NBA CHAMPIONS 🏆");
  expect(items.some((i) => i.startsWith("GAME "))).toBe(false);
});

test("buildTickerItems: no next game scheduled -> no game line", () => {
  const items = buildTickerItems(mk({ nextGame: null }));
  expect(items.some((i) => i.startsWith("GAME "))).toBe(false);
});

test("isValidSeries rejects bad data", () => {
  expect(isValidSeries(mk({}))).toBe(true);
  expect(isValidSeries(mk({ wins: 9 }))).toBe(false);
  expect(isValidSeries({ ...base, status: "bogus" } as unknown)).toBe(false);
  expect(isValidSeries(null)).toBe(false);
});

test("cron refresh-series rejects unauthorized requests (401)", async ({ request }) => {
  const noAuth = await request.get("/api/cron/refresh-series");
  expect(noAuth.status()).toBe(401);
  const badAuth = await request.get("/api/cron/refresh-series", {
    headers: { authorization: "Bearer wrong" },
  });
  expect(badAuth.status()).toBe(401);
});
