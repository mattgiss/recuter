-- ============================================================
-- recuter — website-side Supabase SQL
--
-- The agent backend's tables and the public board now live in proper
-- migrations:
--   supabase/migrations/001_initial_schema.sql  → backend tables
--   supabase/migrations/002_board_and_rls.sql   → RLS lockdown + `board` view
--
-- This file holds only the legacy `waitlist` table used by landing.html
-- (the original coming-soon page, kept for reference).
-- ============================================================

-- Creates the waitlist table + an RLS policy that lets the anonymous
-- public key INSERT new emails but NOT read the list.
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  source      text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "anon can insert waitlist" on public.waitlist;
create policy "anon can insert waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- Note: no SELECT policy = anon cannot read the list. Use the dashboard
-- or the service role key (server-only) to view signups.
