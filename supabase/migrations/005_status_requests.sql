-- ============================================================
-- recuter — status-change requests (the board's "Mark applied" switch)
--
-- The public board is read-only (anon has zero write to jobs/applications),
-- so — exactly like apply_requests (004) — the "Mark applied" button can't
-- mutate the pipeline itself. It drops a row here; the server processes it
-- with the service-role key (`npm run status`) and flips the real status.
--
-- This also fixes the board view so a *submitted* application surfaces as
-- "applied" (the board's display label), and so a still-"draft" prepared
-- application no longer hides the job's own status.
-- ============================================================

create table if not exists public.status_requests (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  to_status     text not null
                check (to_status in ('applied','interviewing','offer','rejected','passed','closed')),
  status        text not null default 'pending',   -- pending | done | error
  note          text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists status_requests_pending_idx
  on public.status_requests (status) where status = 'pending';

alter table public.status_requests enable row level security;

-- anon may submit a request, nothing else (no select/update/delete policy).
drop policy if exists "anon can request status" on public.status_requests;
create policy "anon can request status"
  on public.status_requests
  for insert
  to anon
  with check (true);

grant insert on public.status_requests to anon;

-- ── Board view: map application status → board display status ──
-- 'submitted'  → 'applied'   (board's label for a sent application)
-- null/'draft' → fall through to the job's own status (don't let an
--                un-sent, prepared application mask the job's state)
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
  case
    when a.status = 'submitted'                     then 'applied'
    when a.status is null or a.status = 'draft'     then j.status
    else a.status
  end                                  as status,
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

grant select on public.board to anon, authenticated;
