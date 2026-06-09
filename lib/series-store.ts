import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SEED_SERIES, isValidSeries, type SeriesState } from "@/lib/series";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Read the live series state (row id=1). Wrapped in React cache() so layout + page
 * share one read per request. Falls back to SEED on any problem — the site never breaks.
 */
export const getSeriesState = cache(async (): Promise<SeriesState> => {
  if (!useSupabase) return SEED_SERIES;
  try {
    const { data, error } = await db()
      .from("series_state")
      .select("state")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    return isValidSeries(data?.state) ? (data!.state as SeriesState) : SEED_SERIES;
  } catch (e) {
    console.error("getSeriesState: falling back to SEED", e);
    return SEED_SERIES;
  }
});

/** Upsert the live series state (called by the cron). */
export async function saveSeriesState(state: SeriesState, source: string): Promise<void> {
  if (!useSupabase) throw new Error("Supabase not configured");
  const { error } = await db()
    .from("series_state")
    .upsert(
      { id: 1, state, source, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw new Error(`saveSeriesState: ${error.message}`);
}
