-- ============================================================
-- recuter — public board + RLS lockdown
-- Phase: website read path
--
-- 001 created the backend tables without RLS, which — under Supabase's
-- default grants — left them readable by the public anon key. This
-- migration (1) enables RLS on every backend table so the anon key can no
-- longer read them directly, and (2) adds a curated, read-only `board`
-- view that the public website (recuter.com) reads through.
--
-- The server/ app uses the SERVICE-ROLE key, which bypasses RLS, so it is
-- unaffected. No anon policies are added, so the anon key gets zero rows
-- from the base tables — its only read path is the `board` view below.
-- ============================================================

-- ── 1. Lock down the backend tables ─────────────────────────
alter table public.employers      enable row level security;
alter table public.jobs           enable row level security;
alter table public.applications   enable row level security;
alter table public.resumes        enable row level security;
alter table public.cover_letters  enable row level security;
alter table public.contacts       enable row level security;
alter table public.email_threads  enable row level security;
alter table public.email_messages enable row level security;
alter table public.credentials    enable row level security;
alter table public.follow_ups     enable row level security;
alter table public.scraper_runs   enable row level security;

-- ── 2. Curated public board view (safe columns only) ────────
-- security_invoker = false → the view runs as its OWNER (postgres), so it
-- can read the base tables even though anon cannot. Anon only ever gets the
-- columns selected here — NO description, score_reasoning, raw_data, emails,
-- or credentials. Display status = latest application's status, else job's.
create or replace view public.board with (security_invoker = false) as
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

-- ── 3. Public read access to the view only ──────────────────
grant select on public.board to anon, authenticated;
