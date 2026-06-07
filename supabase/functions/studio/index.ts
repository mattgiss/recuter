// Supabase Edge Function: studio
// The private read path for recuter's portfolio library. The public board
// (anon) deliberately can't read résumé / cover-letter text — RLS blocks it.
// This function sits behind a shared password and returns, per applied job,
// the exact documents you applied with PLUS every version on file, using the
// service-role key server-side (never exposed to the browser).
//
// A "portfolio" = the tailored résumé + cover letter for one job.
//
// Deploy:  supabase functions deploy studio --no-verify-jwt
// Secrets: supabase secrets set STUDIO_PASSWORD=...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

/** Length-independent string compare so the password can't be timed out. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface DocVersion {
  id: string
  content: string
  version: number | null
  createdAt: string
}

interface Portfolio {
  applicationId: string
  status: string
  appliedAt: string | null
  platform: string | null
  job: {
    id: string
    title: string
    company: string
    url: string | null
    source: string | null
    score: number | null
    location: string | null
  }
  // The exact documents this application was sent / prepared with.
  resume: DocVersion | null
  coverLetter: { id: string; content: string; createdAt: string } | null
  // Every version on file for this job, newest first (the "version history").
  resumeVersions: DocVersion[]
  coverLetterVersions: Array<{ id: string; content: string; createdAt: string }>
}

// deno-lint-ignore no-explicit-any
async function buildLibrary(supabase: any): Promise<Portfolio[]> {
  // Pull every application that has at least a résumé attached — these are the
  // portfolios. Order newest-first by applied date, then creation.
  const { data: apps, error } = await supabase
    .from('applications')
    .select('id, job_id, status, applied_at, platform, resume_id, cover_letter_id, created_at')
    .not('resume_id', 'is', null)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(`applications: ${error.message}`)

  const out: Portfolio[] = []
  for (const a of apps ?? []) {
    const { data: job } = await supabase
      .from('jobs')
      .select('id, title, url, source, score, location, employer_id')
      .eq('id', a.job_id)
      .maybeSingle()
    if (!job) continue

    const { data: emp } = job.employer_id
      ? await supabase.from('employers').select('name').eq('id', job.employer_id).maybeSingle()
      : { data: null }

    const { data: resumes } = await supabase
      .from('resumes')
      .select('id, content, version, created_at')
      .eq('job_id', a.job_id)
      .order('version', { ascending: false })
      .order('created_at', { ascending: false })

    const { data: letters } = await supabase
      .from('cover_letters')
      .select('id, content, created_at')
      .eq('job_id', a.job_id)
      .order('created_at', { ascending: false })

    const resumeVersions: DocVersion[] = (resumes ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      content: r.content as string,
      version: (r.version as number) ?? null,
      createdAt: r.created_at as string,
    }))
    const coverLetterVersions = (letters ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      content: c.content as string,
      createdAt: c.created_at as string,
    }))

    out.push({
      applicationId: a.id,
      status: a.status,
      appliedAt: a.applied_at,
      platform: a.platform,
      job: {
        id: job.id,
        title: job.title,
        company: (emp?.name as string) ?? '',
        url: job.url ?? null,
        source: job.source ?? null,
        score: job.score ?? null,
        location: job.location ?? null,
      },
      resume: resumeVersions.find(r => r.id === a.resume_id) ?? null,
      coverLetter: coverLetterVersions.find(c => c.id === a.cover_letter_id) ?? null,
      resumeVersions,
      coverLetterVersions,
    })
  }
  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const password = Deno.env.get('STUDIO_PASSWORD')
  if (!password) return json({ error: 'STUDIO_PASSWORD not configured' }, 500)

  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'expected JSON body' }, 400)
  }
  if (!body.password || !safeEqual(body.password, password)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const portfolios = await buildLibrary(supabase)
    return json({ portfolios })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
