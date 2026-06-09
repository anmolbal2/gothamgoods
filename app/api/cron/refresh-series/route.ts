import { scrapeSeries } from "@/lib/scrape-series";
import { saveSeriesState } from "@/lib/series-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refreshes the live series state. Triggered by GitHub Actions (every ~2h) and a
 * daily Vercel cron — both send `Authorization: Bearer <CRON_SECRET>`.
 * On any scrape failure it keeps the last-good value (returns updated:false).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { state, source } = await scrapeSeries();
    await saveSeriesState(state, source);
    return Response.json({ updated: true, source, state });
  } catch (e) {
    console.error("refresh-series: keeping last-good", e);
    return Response.json({
      updated: false,
      reason: e instanceof Error ? e.message : "unknown",
    });
  }
}
