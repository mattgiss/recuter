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


-- =====================================================================
-- jobs — the public board.
-- Anyone with the anon key can READ the board, but only the service role
-- (you / the agent, server-side) can write. The board page filters to
-- listings that are still "possible" via is_active.
-- =====================================================================

create table if not exists public.jobs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  company      text not null,
  location     text,                -- e.g. "Denver, CO"
  remote       text,                -- "Remote" | "Hybrid" | "On-site"
  url          text,                -- the posting / apply link
  source       text,                -- "LinkedIn" | "Indeed" | "Greenhouse" ...
  category     text,                -- GIS subfield: "Remote sensing", "Hydraulic" ...
  salary       text,                -- free-text, e.g. "$70k–$90k"
  match_score  int,                 -- 0–100 relevance score
  -- where it is in the pipeline. The board understands these values:
  --   recommended | applied | interviewing | offer | closed | rejected | passed
  status       text not null default 'recommended',
  posted_at    timestamptz,         -- when the role was posted
  applied_at   timestamptz,         -- when you applied (if applicable)
  closes_at    timestamptz,         -- when it stops being "possible" (optional)
  is_active    boolean not null default true,  -- show on the board?
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- keep updated_at fresh on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- helpful for the board's ordering/filtering
create index if not exists jobs_active_score_idx
  on public.jobs (is_active, match_score desc);

alter table public.jobs enable row level security;

-- anon can read only the active listings; no insert/update/delete for anon.
drop policy if exists "anon can read active jobs" on public.jobs;
create policy "anon can read active jobs"
  on public.jobs
  for select
  to anon
  using (is_active = true);

-- Note: writes happen with the service-role key (Supabase dashboard, SQL
-- editor, or the agent backend) — never from the public anon key.
