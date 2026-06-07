-- ============================================================
-- recuter — apply requests (the board's "Apply" button)
--
-- The public board is read-only, so the Apply button can't run the
-- browser automation itself. Instead it drops a row here (job_id), the
-- same safe pattern as the old waitlist: anon may INSERT a request but
-- cannot read or change the table. The server (`npm run requests`) reads
-- pending rows with the service-role key, prepares the application, and
-- queues it for the review-first apply run.
-- ============================================================

create table if not exists public.apply_requests (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  status        text not null default 'pending',   -- pending | queued | error
  note          text,
  requested_at  timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists apply_requests_pending_idx
  on public.apply_requests (status) where status = 'pending';

alter table public.apply_requests enable row level security;

-- anon may submit a request, nothing else (no select/update/delete policy).
drop policy if exists "anon can request apply" on public.apply_requests;
create policy "anon can request apply"
  on public.apply_requests
  for insert
  to anon
  with check (true);

grant insert on public.apply_requests to anon;
