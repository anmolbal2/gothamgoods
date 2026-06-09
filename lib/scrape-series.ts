import { isValidSeries, type NextGame, type SeriesState } from "@/lib/series";

const ESPN_API =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/ny/schedule?seasontype=3";
const ESPN_PAGE = "https://www.espn.com/nba/team/schedule/_/name/ny/new-york-knicks";

// ESPN uses 2-letter codes for some teams; normalize the common ones to the
// 3-letter abbreviations fans expect. Knicks are always "NYK".
const ABBR: Record<string, string> = {
  NY: "NYK",
  SA: "SAS",
  GS: "GSW",
  NO: "NOP",
  UTAH: "UTA",
  WSH: "WAS",
};
const abbr = (a?: string) => (a ? (ABBR[a] ?? a) : "");

function prettyRound(raw: string): string {
  const r = (raw || "").trim();
  if (/nba finals/i.test(r)) return "NBA Finals";
  if (/east(ern)?\s+finals/i.test(r)) return "Eastern Conference Finals";
  if (/west(ern)?\s+finals/i.test(r)) return "Western Conference Finals";
  if (/semifinals/i.test(r)) return "Eastern Semifinals";
  if (/1st round|first round/i.test(r)) return "First Round";
  return r;
}

// ---- ESPN JSON API (primary) ----
interface EspnCompetitor {
  homeAway?: string;
  winner?: boolean;
  team?: { abbreviation?: string; displayName?: string; shortDisplayName?: string; name?: string };
}
interface EspnComp {
  notes?: { headline?: string }[];
  competitors?: EspnCompetitor[];
  status?: { type?: { completed?: boolean } };
  broadcasts?: { media?: { shortName?: string } }[];
}
interface EspnEvent {
  date?: string;
  competitions?: EspnComp[];
}
interface EspnSchedule {
  events?: EspnEvent[];
}

interface Parsed {
  round: string;
  gameNum?: number;
  completed: boolean;
  meWin: boolean;
  oppWin: boolean;
  homeAway: "vs" | "@";
  oppAbbr: string;
  oppName: string;
  tipoffISO: string;
}

export function parseEspnSchedule(json: EspnSchedule, now = Date.now()): SeriesState {
  const rows: Parsed[] = [];
  for (const e of json.events ?? []) {
    const c = e.competitions?.[0];
    if (!c || !e.date) continue;
    const headline = c.notes?.[0]?.headline ?? "";
    const me = (c.competitors ?? []).find((x) => x.team?.abbreviation === "NY");
    const opp = (c.competitors ?? []).find((x) => x.team?.abbreviation !== "NY");
    if (!me || !opp) continue;
    const gm = headline.match(/Game\s+(\d+)/i);
    rows.push({
      round: prettyRound(headline.split(/-\s*Game/i)[0] || headline),
      gameNum: gm ? Number(gm[1]) : undefined,
      completed: c.status?.type?.completed === true,
      meWin: me.winner === true,
      oppWin: opp.winner === true,
      homeAway: me.homeAway === "home" ? "vs" : "@",
      oppAbbr: abbr(opp.team?.abbreviation),
      oppName: opp.team?.shortDisplayName || opp.team?.displayName || opp.team?.name || "",
      tipoffISO: e.date,
    });
  }
  if (rows.length === 0) throw new Error("ESPN: no parseable events");

  const upcoming = rows
    .filter((p) => !p.completed && new Date(p.tipoffISO).getTime() >= now - 3 * 3600 * 1000)
    .sort((a, b) => +new Date(a.tipoffISO) - +new Date(b.tipoffISO));
  const completedAll = rows.filter((p) => p.completed);
  const currentRound = upcoming[0]?.round ?? completedAll[completedAll.length - 1]?.round;
  if (!currentRound) throw new Error("ESPN: could not determine current round");

  const inRound = rows.filter((p) => p.round === currentRound);
  const wins = inRound.filter((p) => p.completed && p.meWin).length;
  const losses = inRound.filter((p) => p.completed && p.oppWin).length;
  const next = upcoming.find((p) => p.round === currentRound) ?? null;
  const ref = next ?? inRound.filter((p) => p.completed).at(-1);
  const status: SeriesState["status"] =
    wins >= 4 ? "won" : losses >= 4 ? "lost" : "in_progress";

  const nextGame: NextGame | null =
    status === "in_progress" && next
      ? {
          number: next.gameNum,
          homeAway: next.homeAway,
          opponentName: next.oppName,
          tipoffISO: next.tipoffISO,
          broadcast: undefined,
        }
      : null;
  // attach broadcast for the next game (re-find raw to read broadcasts)
  if (nextGame) {
    const raw = (json.events ?? []).find((e) => e.date === next!.tipoffISO);
    nextGame.broadcast = raw?.competitions?.[0]?.broadcasts?.[0]?.media?.shortName;
  }

  return {
    round: currentRound,
    teamAbbr: "NYK",
    teamName: "New York",
    opponentAbbr: ref?.oppAbbr || "",
    opponentName: ref?.oppName || "",
    wins,
    losses,
    status,
    nextGame,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchSeriesFromEspn(): Promise<SeriesState> {
  const r = await fetch(ESPN_API, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; GothamGoodsBot/1.0)" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`ESPN API ${r.status}`);
  return parseEspnSchedule((await r.json()) as EspnSchedule);
}

// ---- Firecrawl scrape of the ESPN HTML page (fallback; uses FIRECRAWL_API_KEY) ----
interface FirecrawlSeries {
  round?: string;
  opponentName?: string;
  opponentAbbr?: string;
  wins?: number;
  losses?: number;
  status?: string;
  nextGame?: {
    number?: number;
    homeAway?: string;
    opponentName?: string;
    tipoffISO?: string;
    broadcast?: string;
  } | null;
}

export async function fetchSeriesFromFirecrawl(): Promise<SeriesState> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");
  const schema = {
    type: "object",
    properties: {
      round: { type: "string" },
      opponentName: { type: "string" },
      opponentAbbr: { type: "string" },
      wins: { type: "integer" },
      losses: { type: "integer" },
      status: { type: "string" },
      nextGame: {
        type: ["object", "null"],
        properties: {
          number: { type: "integer" },
          homeAway: { type: "string" },
          opponentName: { type: "string" },
          tipoffISO: { type: "string" },
          broadcast: { type: "string" },
        },
      },
    },
  };
  const prompt =
    "From this NY Knicks postseason schedule, return the CURRENT playoff series: round, opponentName, opponentAbbr, Knicks wins and losses in this series, status (in_progress|won|lost), and nextGame {number, homeAway ('vs' if Knicks home, '@' if away), opponentName, tipoffISO (ISO 8601), broadcast} or null if none.";

  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: ESPN_PAGE,
      onlyMainContent: true,
      waitFor: 3000,
      formats: ["json"],
      jsonOptions: { schema, prompt },
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { data?: { json?: FirecrawlSeries; extract?: FirecrawlSeries } };
  const x = j.data?.json ?? j.data?.extract;
  if (!x) throw new Error("Firecrawl returned no structured data");

  return {
    round: prettyRound(String(x.round || "")),
    teamAbbr: "NYK",
    teamName: "New York",
    opponentAbbr: abbr(x.opponentAbbr) || String(x.opponentName || "").slice(0, 3).toUpperCase(),
    opponentName: String(x.opponentName || ""),
    wins: Number(x.wins),
    losses: Number(x.losses),
    status: ["in_progress", "won", "lost"].includes(String(x.status))
      ? (x.status as SeriesState["status"])
      : "in_progress",
    nextGame: x.nextGame
      ? {
          number: x.nextGame.number != null ? Number(x.nextGame.number) : undefined,
          homeAway: x.nextGame.homeAway === "@" || x.nextGame.homeAway === "away" ? "@" : "vs",
          opponentName: String(x.nextGame.opponentName || x.opponentName || ""),
          tipoffISO: String(x.nextGame.tipoffISO || ""),
          broadcast: x.nextGame.broadcast ? String(x.nextGame.broadcast) : undefined,
        }
      : null,
    updatedAt: new Date().toISOString(),
  };
}

/** Try ESPN's official feed first, then Firecrawl. Throws if both fail/invalid. */
export async function scrapeSeries(): Promise<{ state: SeriesState; source: string }> {
  try {
    const state = await fetchSeriesFromEspn();
    if (isValidSeries(state)) return { state, source: "espn-api" };
    console.error("scrapeSeries: ESPN returned invalid data", state);
  } catch (e) {
    console.error("scrapeSeries: ESPN failed", e);
  }
  try {
    const state = await fetchSeriesFromFirecrawl();
    if (isValidSeries(state)) return { state, source: "firecrawl" };
    console.error("scrapeSeries: Firecrawl returned invalid data", state);
  } catch (e) {
    console.error("scrapeSeries: Firecrawl failed", e);
  }
  throw new Error("All series data sources failed");
}
