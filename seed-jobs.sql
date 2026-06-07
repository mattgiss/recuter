-- =====================================================================
-- SAMPLE jobs so you can SEE the board working end-to-end.
-- Run this once in the Supabase SQL editor AFTER supabase-schema.sql.
-- These are made-up listings — delete them when real ones flow in:
--   delete from public.jobs where source = 'sample';
-- =====================================================================

insert into public.jobs
  (title, company, location, remote, url, source, category, salary, match_score, status, posted_at, applied_at, closes_at, is_active)
values
  ('GIS Analyst — Watershed Modeling', 'BlueRiver Hydraulics', 'Denver, CO', 'Hybrid',
   'https://example.com/jobs/1', 'sample', 'Hydraulic / Civil', '$72k–$88k', 94,
   'recommended', now() - interval '6 hours', null, now() + interval '2 days', true),

  ('Remote Sensing Specialist (Drone Capture)', 'Skyfield Geomatics', 'Remote (US)', 'Remote',
   'https://example.com/jobs/2', 'sample', 'Remote sensing', '$80k–$100k', 91,
   'recommended', now() - interval '1 day', null, now() + interval '9 days', true),

  ('Environmental GIS Technician', 'Cedar & Stone Consulting', 'Portland, OR', 'On-site',
   'https://example.com/jobs/3', 'sample', 'Environmental', '$60k–$70k', 83,
   'applied', now() - interval '5 days', now() - interval '2 days', null, true),

  ('Geospatial Data Engineer', 'TerraGrid', 'Austin, TX', 'Hybrid',
   'https://example.com/jobs/4', 'sample', 'Remote sensing', '$95k–$120k', 88,
   'interviewing', now() - interval '12 days', now() - interval '9 days', null, true),

  ('Junior GIS Mapper', 'Coastline Surveys', 'Tampa, FL', 'On-site',
   'https://example.com/jobs/5', 'sample', 'Environmental', '$52k–$58k', 76,
   'offer', now() - interval '20 days', now() - interval '16 days', null, true),

  ('GIS Coordinator — Stormwater', 'Metro Public Works', 'Sacramento, CA', 'On-site',
   'https://example.com/jobs/6', 'sample', 'Hydraulic / Civil', '$68k–$79k', 71,
   'closed', now() - interval '30 days', null, now() - interval '2 days', true),

  ('Spatial Analyst, Land Use', 'Northwind Planning', 'Remote (US)', 'Remote',
   'https://example.com/jobs/7', 'sample', 'Environmental', '$65k–$82k', 64,
   'passed', now() - interval '8 days', null, null, true);
