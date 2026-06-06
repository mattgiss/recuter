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

// ── Agent helpers ─────────────────────────────────────────────────────────────

export interface RawJob {
  id: string
  title: string
  company: string
  location: string | null
  salary_min: number | null
  salary_max: number | null
  salary_raw: string | null
  description: string | null
  source: string
  url: string
  employer_id: string | null
}

/** Fetch all new (unscored) jobs. */
export async function getUnscoredJobs(): Promise<RawJob[]> {
  const { data, error } = await db
    .from('jobs')
    .select(`
      id, title, location, salary_min, salary_max, salary_raw,
      description, source, url, employer_id,
      employers!inner(name)
    `)
    .eq('status', 'new')
    .order('discovered_at', { ascending: false })

  if (error) throw new Error(`getUnscoredJobs failed: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    company: (row.employers as Record<string, unknown>)?.name as string ?? '',
    location: row.location as string | null,
    salary_min: row.salary_min as number | null,
    salary_max: row.salary_max as number | null,
    salary_raw: row.salary_raw as string | null,
    description: row.description as string | null,
    source: row.source as string,
    url: row.url as string,
    employer_id: row.employer_id as string | null,
  }))
}

/** Write score + reasoning back to a job, update status to 'scored'. */
export async function updateJobScore(
  jobId: string,
  score: number,
  reasoning: string
): Promise<void> {
  const { error } = await db
    .from('jobs')
    .update({ score, score_reasoning: reasoning, status: 'scored' })
    .eq('id', jobId)

  if (error) throw new Error(`updateJobScore failed: ${error.message}`)
}

/** Update only the status field on a job. */
export async function updateJobStatus(
  jobId: string,
  status: string
): Promise<void> {
  const { error } = await db
    .from('jobs')
    .update({ status })
    .eq('id', jobId)

  if (error) throw new Error(`updateJobStatus failed: ${error.message}`)
}

/** Fetch high-scoring jobs ready for document generation. */
export async function getQueuedJobs(scoreMin: number): Promise<RawJob[]> {
  const { data, error } = await db
    .from('jobs')
    .select(`
      id, title, location, salary_min, salary_max, salary_raw,
      description, source, url, employer_id,
      employers!inner(name)
    `)
    .eq('status', 'scored')
    .gte('score', scoreMin)
    .order('score', { ascending: false })

  if (error) throw new Error(`getQueuedJobs failed: ${error.message}`)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    company: (row.employers as Record<string, unknown>)?.name as string ?? '',
    location: row.location as string | null,
    salary_min: row.salary_min as number | null,
    salary_max: row.salary_max as number | null,
    salary_raw: row.salary_raw as string | null,
    description: row.description as string | null,
    source: row.source as string,
    url: row.url as string,
    employer_id: row.employer_id as string | null,
  }))
}

/** Create an application record, return its id. */
export async function createApplication(
  jobId: string,
  employerId: string | null
): Promise<string> {
  const { data, error } = await db
    .from('applications')
    .insert({ job_id: jobId, employer_id: employerId, status: 'draft' })
    .select('id')
    .single()

  if (error) throw new Error(`createApplication failed: ${error.message}`)
  return data.id
}

/** Save a resume, return its id. */
export async function saveResume(
  jobId: string,
  applicationId: string,
  content: string
): Promise<string> {
  const { data, error } = await db
    .from('resumes')
    .insert({ job_id: jobId, application_id: applicationId, content })
    .select('id')
    .single()

  if (error) throw new Error(`saveResume failed: ${error.message}`)
  return data.id
}

/** Save a cover letter, return its id. */
export async function saveCoverLetter(
  jobId: string,
  applicationId: string,
  content: string
): Promise<string> {
  const { data, error } = await db
    .from('cover_letters')
    .insert({ job_id: jobId, application_id: applicationId, content })
    .select('id')
    .single()

  if (error) throw new Error(`saveCoverLetter failed: ${error.message}`)
  return data.id
}

/** Link resume and cover letter ids onto an application record. */
export async function linkApplicationDocuments(
  applicationId: string,
  resumeId: string,
  coverLetterId: string
): Promise<void> {
  const { error } = await db
    .from('applications')
    .update({ resume_id: resumeId, cover_letter_id: coverLetterId })
    .eq('id', applicationId)

  if (error) throw new Error(`linkApplicationDocuments failed: ${error.message}`)
}
