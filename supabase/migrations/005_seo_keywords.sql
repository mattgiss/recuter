-- ============================================================
-- recuter — SEO / ATS keywords
--
-- The simplified recuter weaves these keywords into every tailored
-- resume and cover letter so your applications mirror the language
-- recruiters and ATS systems scan for. Edit this list anytime in the
-- Supabase Table Editor (profile row) — the generator reads it live.
-- ============================================================

alter table public.profile
  add column if not exists seo_keywords text[] not null default '{}';

-- Seed a starter set drawn from Matt's target roles + skills (idempotent:
-- only fills the column if it's still empty on the singleton row).
update public.profile
set seo_keywords = array[
  'GIS', 'Geographic Information Systems', 'ArcGIS Pro', 'ArcGIS Online',
  'Spatial Analysis', 'Geospatial Data', 'Cartography', 'Remote Sensing',
  'Photogrammetry', 'Aerial Mapping', 'UAS', 'Drone Operations',
  'FAA Part 107', 'GPS', 'GNSS', 'Global Mapper', 'Data QA/QC',
  'Python', 'SQL', 'Data Pipelines', 'Field Data Collection',
  'Geodatabase', 'Map Projections', 'Coordinate Systems'
]
where id = 1
  and (seo_keywords is null or cardinality(seo_keywords) = 0);
