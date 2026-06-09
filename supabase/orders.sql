-- Gotham Goods order ledger. Run in the Supabase SQL editor (or via migration).
-- Required in production (the in-memory fallback is per-instance and ephemeral).

create table if not exists public.orders (
  id                bigint generated always as identity primary key,
  session_id        text unique not null,          -- Stripe checkout session id (idempotency key)
  printify_order_id text,                           -- returned by createConfirmedOrder
  email             text,                           -- buyer email, for the shipped-email lookup
  status            text not null default 'created',
  tracking_number   text,
  tracking_url      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_printify_order_id_idx
  on public.orders (printify_order_id);

-- Only the server (service_role key) touches this table; service_role bypasses RLS.
-- Enable RLS with no public policies so the anon/auth keys can never read it.
alter table public.orders enable row level security;
