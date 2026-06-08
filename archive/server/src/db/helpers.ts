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

// ── Apply step (review-first automation) ──────────────────────────────────────

export interface PreparedApplication {
  applicationId: string
  jobId: string
  jobUrl: string
  jobTitle: string
  company: string
  source: string
  resumeContent: string
  coverLetterContent: string | null
}

/**
 * Applications whose documents are drafted (status 'draft', resume attached) and
 * whose job is still 'queued' — i.e. ready for Recuter to fill in on LinkedIn.
 * Fetched with simple sequential reads to keep the query robust.
 */
export async function getPreparedApplications(sourceFilter?: string): Promise<PreparedApplication[]> {
  const { data: apps, error } = await db
    .from('applications')
    .select('id, job_id, resume_id, cover_letter_id')
    .eq('status', 'draft')
    .not('resume_id', 'is', null)

  if (error) throw new Error(`getPreparedApplications failed: ${error.message}`)

  const out: PreparedApplication[] = []
  for (const a of apps ?? []) {
    const { data: job } = await db
      .from('jobs')
      .select('url, title, status, source, employer_id')
      .eq('id', a.job_id)
      .maybeSingle()

    if (!job || job.status !== 'queued') continue
    if (sourceFilter && job.source !== sourceFilter) continue

    const { data: emp } = job.employer_id
      ? await db.from('employers').select('name').eq('id', job.employer_id).maybeSingle()
      : { data: null }

    const { data: res } = await db.from('resumes').select('content').eq('id', a.resume_id).maybeSingle()
    const { data: cl } = a.cover_letter_id
      ? await db.from('cover_letters').select('content').eq('id', a.cover_letter_id).maybeSingle()
      : { data: null }

    out.push({
      applicationId: a.id as string,
      jobId: a.job_id as string,
      jobUrl: job.url as string,
      jobTitle: job.title as string,
      company: (emp?.name as string) ?? '',
      source: job.source as string,
      resumeContent: (res?.content as string) ?? '',
      coverLetterContent: (cl?.content as string) ?? null,
    })
  }
  return out
}

/** Mark an application as prepped-and-awaiting-your-submit; move job to 'applying'. */
export async function markApplicationPrepared(applicationId: string, jobId: string): Promise<void> {
  await db
    .from('applications')
    .update({ platform: 'linkedin', notes: 'Prepared by Recuter — awaiting your review & submit' })
    .eq('id', applicationId)
  await db.from('jobs').update({ status: 'applying' }).eq('id', jobId)
}

// ── Apply requests (the board's "Apply" button) ───────────────────────────────

export interface ApplyRequest {
  id: string
  jobId: string
}

/** Pending apply requests submitted from the board. */
export async function getPendingApplyRequests(): Promise<ApplyRequest[]> {
  const { data, error } = await db
    .from('apply_requests')
    .select('id, job_id')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) throw new Error(`getPendingApplyRequests failed: ${error.message}`)
  return (data ?? []).map(r => ({ id: r.id as string, jobId: r.job_id as string }))
}

/** Mark an apply request handled. */
export async function markApplyRequestDone(
  id: string,
  status: 'queued' | 'error',
  note?: string
): Promise<void> {
  await db
    .from('apply_requests')
    .update({ status, note: note ?? null, processed_at: new Date().toISOString() })
    .eq('id', id)
}

/** Fetch a single job by id, shaped for document generation. */
export async function getJobById(jobId: string): Promise<RawJob | null> {
  const { data, error } = await db
    .from('jobs')
    .select(`
      id, title, location, salary_min, salary_max, salary_raw,
      description, source, url, employer_id,
      employers(name)
    `)
    .eq('id', jobId)
    .maybeSingle()

  if (error) throw new Error(`getJobById failed: ${error.message}`)
  if (!data) return null

  const row = data as Record<string, unknown>
  return {
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
  }
}

/** True if the job already has an application with a résumé attached. */
export async function jobHasApplicationWithResume(jobId: string): Promise<boolean> {
  const { data } = await db
    .from('applications')
    .select('id')
    .eq('job_id', jobId)
    .not('resume_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return !!data
}

// ── Inbox (recruiter replies → drafted responses) ─────────────────────────────

export interface InboundThread {
  threadId: string
  subject: string
  fromEmail: string
  body: string
}

/** Threads that came in via email and still need a drafted reply. */
export async function getThreadsNeedingReply(): Promise<InboundThread[]> {
  const { data: threads, error } = await db
    .from('email_threads')
    .select('id, subject')
    .eq('status', 'needs_reply')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`getThreadsNeedingReply failed: ${error.message}`)

  const out: InboundThread[] = []
  for (const t of threads ?? []) {
    const { data: msg } = await db
      .from('email_messages')
      .select('from_email, body, subject')
      .eq('thread_id', t.id)
      .eq('direction', 'inbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!msg) continue
    out.push({
      threadId: t.id as string,
      subject: (t.subject as string) ?? (msg.subject as string) ?? '',
      fromEmail: (msg.from_email as string) ?? '',
      body: (msg.body as string) ?? '',
    })
  }
  return out
}

/** Find an employer whose name loosely matches; returns id + latest application. */
export async function matchEmployerApplication(
  company: string
): Promise<{ employerId: string; applicationId: string | null; jobTitle: string | null } | null> {
  if (!company.trim()) return null

  const { data: emp } = await db
    .from('employers')
    .select('id')
    .ilike('name', `%${company.trim()}%`)
    .limit(1)
    .maybeSingle()
  if (!emp) return null

  const { data: app } = await db
    .from('applications')
    .select('id, job_id')
    .eq('employer_id', emp.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let jobTitle: string | null = null
  if (app?.job_id) {
    const { data: job } = await db.from('jobs').select('title').eq('id', app.job_id).maybeSingle()
    jobTitle = (job?.title as string) ?? null
  }

  return {
    employerId: emp.id as string,
    applicationId: (app?.id as string) ?? null,
    jobTitle,
  }
}

/** Create a contact for the person who emailed, if we don't have them. */
export async function upsertContact(input: {
  employerId?: string | null
  applicationId?: string | null
  name?: string | null
  email: string
}): Promise<string | null> {
  if (!input.email) return null
  const { data: existing } = await db
    .from('contacts')
    .select('id')
    .eq('email', input.email)
    .maybeSingle()
  if (existing) return existing.id

  const { data, error } = await db
    .from('contacts')
    .insert({
      employer_id: input.employerId ?? null,
      application_id: input.applicationId ?? null,
      name: input.name ?? null,
      email: input.email,
    })
    .select('id')
    .single()
  if (error) return null
  return data.id
}

/** Save the drafted reply and mark the thread handled (awaiting your send). */
export async function saveDraftReply(input: {
  threadId: string
  subject: string
  body: string
  toEmail: string
  applicationId?: string | null
  contactId?: string | null
}): Promise<void> {
  await db.from('email_messages').insert({
    thread_id: input.threadId,
    subject: input.subject,
    body: input.body,
    to_email: input.toEmail,
    direction: 'outbound',
    is_draft: true,
  })

  const threadUpdate: Record<string, unknown> = { status: 'active' }
  if (input.applicationId) threadUpdate.application_id = input.applicationId
  if (input.contactId) threadUpdate.contact_id = input.contactId
  await db.from('email_threads').update(threadUpdate).eq('id', input.threadId)
}
