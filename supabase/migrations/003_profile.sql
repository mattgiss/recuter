-- ============================================================
-- recuter — master career record (single source of truth)
--
-- Your work history, education, certifications, skills, and profile
-- live here so the agents (scorer, resume, cover letter, reply writer)
-- always read your real, current experience. Update it anytime in the
-- Supabase Table Editor — every agent picks the change up on its next run.
--
-- Private tables: RLS on, no anon policy. The server reads them with the
-- service-role key; the public board never touches them.
-- ============================================================

-- ── profile: one row, the top-level facts + skills + voice ──
create table if not exists public.profile (
  id                       int primary key default 1,
  name                     text not null,
  email                    text,
  phone                    text,
  location                 text,
  linkedin                 text,
  github                   text,
  portfolio_url            text,
  summary                  text,
  target_roles             text[]  not null default '{}',
  target_salary_gross_min  int,
  target_locations         text[]  not null default '{}',
  willing_to_relocate      boolean not null default false,
  preferred_industries     text[]  not null default '{}',
  deal_breakers            text[]  not null default '{}',
  skills                   jsonb   not null default '{}',   -- { category: [skills] }
  voice                    jsonb   not null default '{}',   -- { signoff, guidelines, availability }
  updated_at               timestamptz not null default now(),
  constraint profile_singleton check (id = 1)
);

-- ── experience: your job history, newest first by sort_order ──
create table if not exists public.experience (
  id          uuid primary key default gen_random_uuid(),
  sort_order  int not null default 0,
  title       text not null,
  company     text not null,
  location    text,
  period      text,                       -- e.g. "Jul 2022 – Jan 2026"
  is_current  boolean not null default false,
  highlights  text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── education ──
create table if not exists public.education (
  id           uuid primary key default gen_random_uuid(),
  sort_order   int not null default 0,
  degree       text not null,
  institution  text not null,
  location     text,
  period       text,                      -- e.g. "Sep 2025 – Mar 2027"
  in_progress  boolean not null default false,
  details      text
);

-- ── certifications ──
create table if not exists public.certifications (
  id          uuid primary key default gen_random_uuid(),
  sort_order  int not null default 0,
  name        text not null,
  issuer      text,
  year        text,
  current     boolean not null default true
);

-- private to the service role only
alter table public.profile        enable row level security;
alter table public.experience     enable row level security;
alter table public.education      enable row level security;
alter table public.certifications enable row level security;

-- ── seed: Matt's consolidated record (idempotent — only if empty) ──
do $$
begin
  if not exists (select 1 from public.profile) then

    insert into public.profile (
      id, name, email, phone, location, linkedin, github, portfolio_url, summary,
      target_roles, target_salary_gross_min, target_locations, willing_to_relocate,
      preferred_industries, deal_breakers, skills, voice
    ) values (
      1,
      'Matthew Gissentanna',
      'matt@gissentanna.com',
      '720-965-5369',
      'Brighton, CO',
      'linkedin.com/in/matthewgissentanna',
      'github.com/mattgiss',
      'https://mattgiss.github.io/recuter/portfolio/',
      'Geospatial and UAS professional transitioning into GIS, backed by 18+ years leading technical programs at Amazon/AWS, Rubrik, and beyond. FAA Part 107 remote pilot with hands-on commercial drone mapping, photogrammetry, and aerial data processing, currently completing a Graduate Certificate in GIS & Unmanned Aircraft Systems at the University of Denver. Pairs real field and sensor operations with deep experience building data pipelines, quality-assurance systems, and cross-functional execution.',
      array['GIS Analyst','GIS Technician','Geospatial Analyst','Geospatial Data Technician','Remote Sensing Technician','UAS / Drone Pilot','Photogrammetry Technician','GIS Specialist'],
      75000,
      array['Denver, CO','Brighton, CO','Colorado','Remote'],
      false,
      array['Surveying & Mapping','UAS / Drone Services','Geospatial / GIS','Environmental','Government / Public Sector','AEC / Engineering','Utilities / Infrastructure','Technology'],
      array['Fully on-site role outside the Denver/Colorado area','Requires permanent relocation out of Colorado'],
      jsonb_build_object(
        'geospatial',        array['ArcGIS Pro','ArcGIS Online','GIS Data Analysis','Global Mapper','Cartography & Map Projections','Spatial Analysis'],
        'remoteSensing',     array['Aerial Mapping & Photogrammetry','Remote Sensing Data Processing','Sensor Calibration & Operation','GPS/GNSS Operations'],
        'uasOperations',     array['FAA Part 107','UAS Mission Planning','Multi-rotor Flight Operations','Field Data Collection & Logging','Equipment Maintenance & Troubleshooting','Flight Safety'],
        'programManagement', array['Agile & Scrum','Waterfall Delivery','Stakeholder Management','KPIs/SLAs & Metrics','Process Mapping','Risk Management','Budget Oversight','Cross-functional Leadership'],
        'technical',         array['Python (in progress)','SQL / MySQL','JSON/YAML/XML','Git & GitHub','AWS','Data Pipelines & Automation','Data QA/QC'],
        'tools',             array['ArcGIS Pro','Global Mapper','Jira','Confluence','Adobe Creative Suite','VS Code']
      ),
      jsonb_build_object(
        'signoff', E'Best,\nMatt Gissentanna',
        'guidelines', 'Warm, genuine, and professional — never stiff or corporate. Concise: two or three short paragraphs at most. Plain language; contractions are fine. Enthusiastic about GIS and geospatial work without overselling. Specific over generic. For interview invites: thank them, confirm enthusiasm, and offer concrete availability. For screening questions: answer directly and briefly, tying back to relevant experience. For rejections: a short, gracious thank-you that keeps the door open. Never invent facts, dates, or commitments — when something needs your input, leave a clearly marked [bracketed note].',
        'availability', 'weekday mornings and early afternoons, Mountain Time'
      )
    );

    insert into public.experience (sort_order, title, company, location, period, is_current, highlights) values
    (1, 'Owner / UAS Pilot & Aerial Mapping Operator', 'Liquid Sun Creative', 'Brighton, CO', '2024 – Present', true, array[
      'Plan and execute commercial drone mapping missions — pre-flight planning, sensor configuration, and flight operations for aerial data acquisition.',
      'Process and quality-check aerial imagery and geospatial data, ensuring accuracy standards before client delivery.',
      'Maintain and troubleshoot UAS equipment: multi-rotor platforms, cameras, GPS receivers, and ground control stations.',
      'Complete detailed field logs, mission reports, and data documentation for each operation.',
      'Coordinate with clients and subcontractors on scheduling, site readiness, and safety protocols.']),
    (2, 'Senior Technical Program Manager', 'Amazon (AWS & Devices)', 'Denver, CO', 'Jul 2022 – Jan 2026', false, array[
      'Built and managed automated data-processing pipelines, reducing manual handling and improving reporting accuracy across 200+ data points.',
      'Led an org-level vulnerability-management program for 154 engineers, defining KPIs/SLAs and tracking CVE discovery, remediation, and distribution while remaining FedRAMP compliant.',
      'Led cross-functional programs with 400+ stakeholders, coordinating field-level execution to 95% on-time completion.',
      'Designed tracking and QA systems that improved remediation efficiency by 50% and cut backlog by 80%.',
      'Briefed Directors and VPs through weekly and monthly business reviews and operations reviews.']),
    (3, 'Project Manager – Professional Services', 'Rubrik', 'Palo Alto, CA (Remote)', 'May 2021 – Jul 2022', false, array[
      'Managed two of the largest deployment projects in company history ($10M+ budgets, 200+ team members).',
      'Optimized task assignment and resource allocation, increasing efficiency 35% and on-time delivery 20%.',
      'Maintained quality control across the project lifecycle to hold technical standards and schedule.']),
    (4, 'IT Supervisor – Application Development & Delivery', 'Synovus Financial', 'Columbus, GA', 'Jun 2018 – May 2021', false, array[
      'Led a cross-functional scrum team modernizing digital and mobile banking applications (security, accessibility, performance).',
      'Managed 2 business analysts and 3 application engineers; served as Jira administrator and Center-of-Excellence lead.',
      'Acted as the central liaison between engineers, subject-matter experts, and business owners across development and testing.']),
    (5, 'Scrum Master – Product Management', 'Omega Financial', 'Columbus, GA', 'Feb 2016 – Jun 2018', false, array[
      'Led a product-development team and introduced JIRA, Confluence, and Scrum practices company-wide.',
      'Led a tiger team to build a flagship mobile iOS application using Scrum.',
      'Delivered 6 database-conversion projects supporting annual revenue goals.']),
    (6, 'Scrum Master – Product Management', 'Delta Data Software', 'Columbus, GA', 'Sep 2014 – Feb 2016', false, array[
      'Presented project status to executive leadership; managed incidents, prioritized features, and planned releases.',
      'Coordinated sprint planning, testing, and development; reviewed wireframes for UI and UX alignment.']),
    (7, 'Business Systems Analyst II', 'Aflac', 'Columbus, GA', 'Dec 2007 – Sep 2014', false, array[
      'Liaison between business units and IT; organized JAD sessions for requirements gathering.',
      'Coordinated system testing and production-elevation schedules across on- and off-shore staff.',
      'Supported a team of 8 engineers through agile analysis, requirements, testing, and QA.']);

    insert into public.education (sort_order, degree, institution, location, period, in_progress, details) values
    (1, 'Graduate Certificate, GIS & Unmanned Aircraft Systems', 'University of Denver', 'Denver, CO', 'Sep 2025 – Mar 2027', true, 'Coursework: Cartography & Map Design, GIS Fundamentals, Remote Sensing, UAS Operations.'),
    (2, 'B.S., Business Administration (Global Business)', 'Troy University', 'Troy, AL', '2010 – 2019', false, null),
    (3, 'A.S., Management & Supervisory Development', 'Columbus Technical College', 'Columbus, GA', '2006 – 2009', false, null),
    (4, 'Business Analysis Executive Program', 'University of Georgia', 'Athens, GA', '2013', false, null);

    insert into public.certifications (sort_order, name, issuer, year, current) values
    (1, 'FAA Part 107 Remote Pilot Certificate', 'FAA', 'current', true),
    (2, 'Project Management Professional (PMP)', 'Project Management Institute', '2017', true),
    (3, 'Certified ScrumMaster (CSM)', 'Scrum Alliance', '2015', true),
    (4, 'CompTIA Server+', 'CompTIA', '2014', true);

  end if;
end $$;
