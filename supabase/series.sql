-- Live finals state, refreshed by the cron (app/api/cron/refresh-series).
-- Single row (id = 1) holding the current SeriesState as jsonb.
-- Run in the Supabase SQL editor if recreating.

create table if not exists public.series_state (
  id          int primary key default 1,
  state       jsonb not null,
  source      text,                         -- 'espn-api' | 'firecrawl'
  updated_at  timestamptz not null default now(),
  constraint series_state_singleton check (id = 1)
);

-- Server-only access (service_role bypasses RLS); no public policies.
alter table public.series_state enable row level security;
