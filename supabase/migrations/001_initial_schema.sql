-- ============================================================
-- recuter — Application Tracking System
-- Phase 1: Foundation schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ── Employers ───────────────────────────────────────────────
create table if not exists employers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  website      text,
  linkedin_url text,
  industry     text,
  notes        text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create unique index if not exists employers_name_lower_idx on employers (lower(trim(name)));

-- ── Jobs (raw discovered postings) ──────────────────────────
create table if not exists jobs (
  id               uuid primary key default gen_random_uuid(),
  employer_id      uuid references employers(id) on delete set null,
  title            text not null,
  description      text,
  url              text not null unique,
  source           text not null,           -- linkedin | indeed | usajobs | ziprecruiter | direct
  location         text,
  remote_type      text default 'unknown'
                   check (remote_type in ('remote','hybrid','onsite','unknown')),
  salary_min       integer,                 -- gross annual USD
  salary_max       integer,
  salary_raw       text,                    -- original string from listing
  posted_at        timestamptz,
  discovered_at    timestamptz default now(),
  status           text default 'new'
                   check (status in ('new','scoring','scored','skipped','queued','applying','applied','failed')),
  score            integer check (score between 1 and 10),
  score_reasoning  text,
  raw_data         jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists jobs_status_idx       on jobs (status);
create index if not exists jobs_score_idx        on jobs (score desc nulls last);
create index if not exists jobs_employer_idx     on jobs (employer_id);
create index if not exists jobs_discovered_idx   on jobs (discovered_at desc);

-- ── Applications (each = a lead) ────────────────────────────
-- resume_id / cover_letter_id added as FKs after dependent tables created
create table if not exists applications (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid references jobs(id) on delete cascade not null,
  employer_id             uuid references employers(id) on delete set null,
  status                  text default 'draft'
                          check (status in (
                            'draft','submitted','acknowledged','screening',
                            'phone_screen','interview','offer',
                            'rejected','withdrawn','ghosted'
                          )),
  platform                text,             -- linkedin | indeed | direct | email
  platform_application_id text,
  applied_at              timestamptz,
  resume_id               uuid,
  cover_letter_id         uuid,
  notes                   text,
  follow_up_due_at        timestamptz,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index if not exists applications_status_idx     on applications (status);
create index if not exists applications_job_idx        on applications (job_id);
create index if not exists applications_employer_idx   on applications (employer_id);
create index if not exists applications_followup_idx   on applications (follow_up_due_at) where follow_up_due_at is not null;

-- ── Resumes (customized per application) ────────────────────
create table if not exists resumes (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references jobs(id) on delete set null,
  application_id  uuid references applications(id) on delete cascade,
  content         text not null,            -- markdown / plain text
  file_path       text,
  version         integer default 1,
  created_at      timestamptz default now()
);

-- ── Cover letters ────────────────────────────────────────────
create table if not exists cover_letters (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid references jobs(id) on delete set null,
  application_id  uuid references applications(id) on delete cascade,
  content         text not null,
  file_path       text,
  created_at      timestamptz default now()
);

-- Back-link FKs on applications now that resume/cover_letter tables exist
alter table applications
  add constraint if not exists applications_resume_fk
    foreign key (resume_id) references resumes(id) on delete set null,
  add constraint if not exists applications_cover_letter_fk
    foreign key (cover_letter_id) references cover_letters(id) on delete set null;

-- ── Contacts (people at employers) ──────────────────────────
create table if not exists contacts (
  id              uuid primary key default gen_random_uuid(),
  employer_id     uuid references employers(id) on delete cascade,
  application_id  uuid references applications(id) on delete set null,
  name            text,
  title           text,
  email           text,
  linkedin_url    text,
  phone           text,
  notes           text,
  created_at      timestamptz default now()
);

-- ── Email threads ────────────────────────────────────────────
create table if not exists email_threads (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid references applications(id) on delete cascade,
  contact_id          uuid references contacts(id) on delete set null,
  external_thread_id  text,                 -- gmail thread id
  subject             text,
  status              text default 'active'
                      check (status in ('active','closed','needs_reply','scheduled')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── Email messages ───────────────────────────────────────────
create table if not exists email_messages (
  id                  uuid primary key default gen_random_uuid(),
  thread_id           uuid references email_threads(id) on delete cascade,
  external_message_id text,
  subject             text,
  body                text,
  from_email          text,
  to_email            text,
  direction           text check (direction in ('inbound','outbound')),
  sent_at             timestamptz,
  is_draft            boolean default false,
  created_at          timestamptz default now()
);

-- ── Platform credentials (encrypted at rest via app layer) ──
create table if not exists credentials (
  id                uuid primary key default gen_random_uuid(),
  platform          text not null unique,
  username          text,
  encrypted_password text,
  cookies           jsonb,
  session_data      jsonb,
  last_used_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── Follow-up scheduler ──────────────────────────────────────
create table if not exists follow_ups (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid references applications(id) on delete cascade not null,
  type            text check (type in ('first','second','third','custom')),
  scheduled_at    timestamptz not null,
  sent_at         timestamptz,
  content         text,
  created_at      timestamptz default now()
);

create index if not exists follow_ups_scheduled_idx on follow_ups (scheduled_at) where sent_at is null;

-- ── Scraper run log ──────────────────────────────────────────
create table if not exists scraper_runs (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  started_at    timestamptz default now(),
  completed_at  timestamptz,
  jobs_found    integer default 0,
  jobs_new      integer default 0,
  status        text default 'running' check (status in ('running','completed','failed')),
  error         text
);

-- ── updated_at triggers ──────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employers_updated_at    before update on employers    for each row execute function set_updated_at();
create trigger jobs_updated_at         before update on jobs         for each row execute function set_updated_at();
create trigger applications_updated_at before update on applications for each row execute function set_updated_at();
create trigger email_threads_updated_at before update on email_threads for each row execute function set_updated_at();
create trigger credentials_updated_at  before update on credentials  for each row execute function set_updated_at();
