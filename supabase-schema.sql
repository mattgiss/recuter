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
-- board — the public job board (a VIEW, not a table).
--
-- The real data lives in the agent-backend tables (jobs, employers,
-- applications, scraped_jobs, ...), which this repo does NOT own or
-- create. The website only needs a safe, read-only window onto them.
--
-- This view exposes ONLY the columns that are safe to show publicly —
-- no description, score_reasoning, raw_data, emails, or credentials.
-- It joins each job to its employer (for the company name) and to its
-- most recent application (for where it stands in the pipeline).
--
-- The board's display `status` = the application's status if the job has
-- been applied to, otherwise the job's own status. The frontend maps
-- whatever strings appear to labels/colors and falls back gracefully.
-- =====================================================================

create or replace view public.board as
select
  j.id,
  j.title,
  e.name                               as company,
  j.location,
  j.remote_type                        as remote,
  j.url,
  j.source,
  j.salary_min,
  j.salary_max,
  j.salary_raw,
  j.score,
  coalesce(a.status, j.status)         as status,
  a.applied_at,
  j.posted_at,
  greatest(j.updated_at, a.updated_at) as updated_at
from public.jobs j
left join public.employers e on e.id = j.employer_id
left join lateral (
  select status, applied_at, updated_at
  from public.applications
  where job_id = j.id
  order by applied_at desc nulls last, created_at desc
  limit 1
) a on true;

-- The view is owned by postgres, so it can read the base tables even though
-- those stay locked down to the anon key. We grant anon read on the VIEW only.
grant select on public.board to anon, authenticated;

-- IMPORTANT (verify once): the base tables (jobs, employers, applications,
-- credentials, email_*, ...) must have RLS enabled with no anon SELECT
-- policy, so the anon key can reach them ONLY through this curated view.
-- Check with:
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;
-- Any row with rowsecurity = false is readable directly by anon.


-- =====================================================================
-- HARDENING (run once). As of 2026-06-07 the backend tables had RLS
-- OFF, which — given Supabase's default grants — left them readable by
-- the public anon key (credentials, emails, resumes, and all). Enabling
-- RLS with no anon policy closes that: the service-role key (agent
-- backend) and the postgres-owned `board` view still work; the anon key
-- can no longer read these tables directly.
--
-- NOTE: this assumes the agent backend writes with the SERVICE-ROLE key.
-- If any part of it uses the anon key, add a narrow policy instead.
-- =====================================================================

alter table public.applications   enable row level security;
alter table public.contacts       enable row level security;
alter table public.cover_letters  enable row level security;
alter table public.credentials    enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_threads  enable row level security;
alter table public.employers      enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.jobs           enable row level security;
alter table public.resumes        enable row level security;
alter table public.scraper_runs   enable row level security;
-- (scraped_jobs and simple_logs already had RLS enabled.)
