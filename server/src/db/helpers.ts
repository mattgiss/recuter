import { db } from './client'
import type { ScrapedJob } from '../scrapers/types'

/** Find or create an employer by name. Returns the employer id. */
export async function upsertEmployer(name: string, website?: string): Promise<string> {
  const normalized = name.trim()

  const { data: existing } = await db
    .from('employers')
    .select('id')
    .ilike('name', normalized)
    .maybeSingle()

  if (existing) return existing.id

  const { data: created, error } = await db
    .from('employers')
    .insert({ name: normalized, website })
    .select('id')
    .single()

  if (error) throw new Error(`upsertEmployer failed: ${error.message}`)
  return created.id
}

/** Save a scraped job. Returns { id, isNew }. Skips if URL already exists. */
export async function saveJob(
  job: ScrapedJob,
  employerId: string,
  runId: string
): Promise<{ id: string; isNew: boolean }> {
  const { data: existing } = await db
    .from('jobs')
    .select('id')
    .eq('url', job.url)
    .maybeSingle()

  if (existing) return { id: existing.id, isNew: false }

  const { data, error } = await db
    .from('jobs')
    .insert({
      employer_id: employerId,
      title: job.title,
      description: job.description ?? null,
      url: job.url,
      source: job.source,
      location: job.location ?? null,
      remote_type: job.remoteType ?? 'unknown',
      salary_min: job.salaryMin ?? null,
      salary_max: job.salaryMax ?? null,
      salary_raw: job.salaryRaw ?? null,
      posted_at: job.postedAt ?? null,
      raw_data: job.rawData ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`saveJob failed for "${job.title}": ${error.message}`)
  return { id: data.id, isNew: true }
}

/** Log the start of a scraper run. Returns the run id. */
export async function startScraperRun(source: string): Promise<string> {
  const { data, error } = await db
    .from('scraper_runs')
    .insert({ source, status: 'running' })
    .select('id')
    .single()

  if (error) throw new Error(`startScraperRun failed: ${error.message}`)
  return data.id
}

/** Update a scraper run record when it finishes. */
export async function finishScraperRun(
  runId: string,
  stats: { jobsFound: number; jobsNew: number; error?: string }
) {
  await db
    .from('scraper_runs')
    .update({
      completed_at: new Date().toISOString(),
      jobs_found: stats.jobsFound,
      jobs_new: stats.jobsNew,
      status: stats.error ? 'failed' : 'completed',
      error: stats.error ?? null,
    })
    .eq('id', runId)
}
