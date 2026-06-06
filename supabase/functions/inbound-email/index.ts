// Supabase Edge Function: inbound-email
// Receives a forwarded job-alert email (from Cloudflare Email Worker, Postmark,
// SendGrid, Mailgun, etc.), extracts the job postings with Claude, and inserts
// them into the `jobs` table as status 'new'. The normal pipeline (npm run score
// / the daily workflow) then scores them and drafts documents.
//
// Deploy:  supabase functions deploy inbound-email --no-verify-jwt
// Secrets: supabase secrets set ANTHROPIC_API_KEY=... INBOUND_EMAIL_TOKEN=...
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically)

import Anthropic from 'npm:@anthropic-ai/sdk@0.101.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ExtractedJob {
  title: string
  company: string
  url: string
  location?: string
  salary_raw?: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Pull the email fields out of whatever provider shape we were handed. */
function normalize(payload: Record<string, unknown>): {
  subject: string
  from: string
  body: string
} {
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = payload[k]
      if (typeof v === 'string' && v.trim()) return v
    }
    return ''
  }
  const subject = pick('subject', 'Subject')
  const from = pick('from', 'From', 'sender')
  const text = pick('text', 'TextBody', 'body-plain', 'stripped-text', 'plain')
  const html = pick('html', 'HtmlBody', 'body-html', 'stripped-html')
  const body = text || (html ? stripHtml(html) : '')
  return { subject, from, body }
}

async function extractJobs(
  anthropic: Anthropic,
  subject: string,
  from: string,
  body: string
): Promise<ExtractedJob[]> {
  const prompt = `This is a job-alert email. Extract every distinct job posting you can find.

From: ${from}
Subject: ${subject}

Body:
${body.slice(0, 12000)}

Return ONLY valid JSON, no other text:
{"jobs":[{"title":"...","company":"...","url":"https://...","location":"...","salary_raw":"..."}]}

Rules:
- Only real, individual job postings. Skip ads, footers, "see all jobs" links, and unsubscribe links.
- "url" must be the direct link to that specific posting. If a posting has no clear link, skip it.
- Omit location/salary_raw if not present. Never invent values.
- If there are no real postings, return {"jobs":[]}.`

  const res = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system:
      'You extract structured job postings from alert emails. You return only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = res.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return []

  let parsed: { jobs?: ExtractedJob[] }
  try {
    parsed = JSON.parse(textBlock.text.trim())
  } catch {
    const m = textBlock.text.match(/\{[\s\S]*\}/)
    if (!m) return []
    parsed = JSON.parse(m[0])
  }
  return (parsed.jobs ?? []).filter((j) => j.title && j.company && /^https?:\/\//.test(j.url))
}

// deno-lint-ignore no-explicit-any
async function upsertEmployer(supabase: any, name: string): Promise<string> {
  const norm = name.trim()
  const { data: existing } = await supabase
    .from('employers')
    .select('id')
    .ilike('name', norm)
    .maybeSingle()
  if (existing) return existing.id
  const { data: created, error } = await supabase
    .from('employers')
    .insert({ name: norm })
    .select('id')
    .single()
  if (error) throw new Error(`upsertEmployer: ${error.message}`)
  return created.id
}

Deno.serve(async (req: Request) => {
  // Shared-secret check so randoms can't post jobs into your pipeline.
  const token = Deno.env.get('INBOUND_EMAIL_TOKEN')
  if (token) {
    const url = new URL(req.url)
    const provided = url.searchParams.get('token') ?? req.headers.get('x-inbound-token')
    if (provided !== token) return new Response('unauthorized', { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return new Response('expected JSON body', { status: 400 })
  }

  const { subject, from, body } = normalize(payload)
  if (!body) return new Response(JSON.stringify({ inserted: 0, note: 'no body' }), { status: 200 })

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const jobs = await extractJobs(anthropic, subject, from, body)

  let inserted = 0
  for (const j of jobs) {
    try {
      // Skip if we've already seen this URL.
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('url', j.url)
        .maybeSingle()
      if (existing) continue

      const employerId = await upsertEmployer(supabase, j.company)
      const { error } = await supabase.from('jobs').insert({
        employer_id: employerId,
        title: j.title,
        url: j.url,
        source: 'email',
        location: j.location ?? null,
        salary_raw: j.salary_raw ?? null,
        status: 'new',
        raw_data: { from, subject },
      })
      if (!error) inserted++
    } catch (_e) {
      // one bad row shouldn't fail the whole email
    }
  }

  return new Response(JSON.stringify({ found: jobs.length, inserted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
