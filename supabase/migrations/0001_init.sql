-- Referral Ecosystem Generator — beta schema.
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- The app also creates these tables on first use (CREATE TABLE IF NOT EXISTS), so this file is the reviewed source of truth.

-- Key-value store: analyses, entitlements, checkout records, AI cache and budget counters.
create table if not exists kv_store (
  ns text not null,
  key text not null,
  value jsonb not null,
  expires_at timestamptz null,
  primary key (ns, key)
);
create index if not exists kv_store_expires_idx on kv_store (expires_at) where expires_at is not null;

-- First-party beta analytics. `simulated` separates dev/demo/test-mode activity from real use.
create table if not exists analytics_events (
  id bigserial primary key,
  ts timestamptz not null default now(),
  name text not null,
  env text not null,
  simulated boolean not null default false,
  tester text null,
  session text null,
  analysis_id text null,
  props jsonb not null default '{}'::jsonb
);
create index if not exists analytics_events_ts_idx on analytics_events (ts desc);
create index if not exists analytics_events_name_idx on analytics_events (name, ts desc);

-- The app connects with the database connection string (server-side only). Lock the tables
-- away from Supabase's public REST/GraphQL APIs: RLS on, no policies, no grants to anon/authenticated.
alter table kv_store enable row level security;
alter table analytics_events enable row level security;
revoke all on kv_store from anon, authenticated;
revoke all on analytics_events from anon, authenticated;

-- Optional housekeeping (run manually or via pg_cron): delete expired KV rows.
-- delete from kv_store where expires_at is not null and expires_at < now();
