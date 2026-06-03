-- Run this in Supabase SQL editor (Database → SQL Editor → New query)
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
