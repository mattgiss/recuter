// ============================================================
// recuter — generate
//
// The whole backend in one function. Give it a job URL (or pasted job
// text) and it:
//   1. reads your master profile from Supabase (skills, experience,
//      education, certifications, SEO keywords),
//   2. fetches + extracts the job description (when given a URL),
//   3. asks Claude for a tailored resume (markdown) and cover letter,
//   4. returns them as JSON for the browser to save.
//
// Secrets (set with `supabase secrets set`):
//   ANTHROPIC_API_KEY   — your Anthropic API key
// Provided automatically by the platform:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const WRITER_MODEL = 'claude-opus-4-8'
const META_MODEL = 'claude-haiku-4-5-20251001'
const PORTFOLIO_FALLBACK = 'https://recuter.com/portfolio/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ── Anthropic Messages API (REST, no SDK) ──────────────────
async function claude(opts: {
  model: string
  system?: string
  prompt: string
  maxTokens: number
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: 'user', content: opts.prompt }],
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Anthropic ${res.status}: ${detail}`)
  }
  const data = await res.json()
  return (data.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
    .trim()
}

// ── Job description fetch + extraction ─────────────────────
async function fetchJobText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#\d+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    // Too little usable text usually means the page is JS-rendered or
    // bot-walled — caller should ask the user to paste instead.
    return text.length >= 400 ? text.slice(0, 12000) : null
  } catch {
    return null
  }
}

// ── Profile loading ────────────────────────────────────────
const SKILL_LABELS: Record<string, string> = {
  geospatial: 'Geospatial & GIS',
  remoteSensing: 'Remote Sensing',
  uasOperations: 'UAS / Drone Operations',
  programManagement: 'Program & Project Management',
  technical: 'Technical',
  tools: 'Tools & Platforms',
}
const labelFor = (k: string) =>
  SKILL_LABELS[k] ??
  k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())

async function loadProfile(db: ReturnType<typeof createClient>) {
  const [profile, experience, education, certifications] = await Promise.all([
    db.from('profile').select('*').eq('id', 1).single(),
    db.from('experience').select('*').order('sort_order'),
    db.from('education').select('*').order('sort_order'),
    db.from('certifications').select('*').order('sort_order'),
  ])
  if (profile.error) throw new Error(`profile: ${profile.error.message}`)
  return {
    p: profile.data,
    experience: experience.data ?? [],
    education: education.data ?? [],
    certifications: certifications.data ?? [],
  }
}

// ── Prompt builders (carried over from the original agents) ─
function resumePrompt(prof: Awaited<ReturnType<typeof loadProfile>>, job: {
  title: string
  company: string
  text: string
}) {
  const { p } = prof
  const exp = prof.experience
    .map(
      (e) =>
        `### ${e.title} — ${e.company} (${e.period ?? ''})\n${(e.highlights ?? [])
          .map((h: string) => `- ${h}`)
          .join('\n')}`,
    )
    .join('\n\n')
  const edu = prof.education
    .map((e) => `**${e.degree}** — ${e.institution}${e.period ? `, ${e.period}` : ''}`)
    .join('\n')
  const certs = prof.certifications
    .map((c) => `- ${c.name}${c.issuer ? ` (${c.issuer})` : ''}`)
    .join('\n')
  const skills = Object.entries((p.skills ?? {}) as Record<string, string[]>)
    .filter(([, list]) => list.length)
    .map(([cat, list]) => `- ${labelFor(cat)}: ${list.join(', ')}`)
    .join('\n')
  const keywords = (p.seo_keywords ?? []).join(', ')

  return `Create a customized, ATS-optimized resume for the job below.

## TARGET JOB
Title: ${job.title}
Company: ${job.company}
Description:
${job.text}

## CANDIDATE PROFILE

**Contact:**
${p.name} | ${p.location ?? ''} | ${p.email ?? ''}${p.phone ? ` | ${p.phone}` : ''}${p.linkedin ? ` | ${p.linkedin}` : ''}

**Professional Summary:**
${p.summary ?? ''}

**Experience:**
${exp}

**Education:**
${edu}
${certs ? `\n**Certifications:**\n${certs}` : ''}

**Skills:**
${skills}

**Priority SEO / ATS keywords to weave in where truthful:**
${keywords}

## INSTRUCTIONS
1. Mirror keywords from the job description and the SEO keyword list (ATS-critical) — only where they are truthful for this candidate.
2. Lead with a punchy 2-3 sentence summary that directly references the role.
3. Reorder and reframe bullet points so the most relevant experience is prominent.
4. Use strong action verbs and quantify achievements where possible.
5. Keep to 1 page worth of content (tight, no filler).
6. Output clean markdown — use # for the name, ## for sections, **bold** for company/titles, - for bullets.
7. Include a "Core Competencies" section with 6-9 keywords pulled from the job description.
8. Never invent credentials, certifications, dates, or experience the candidate does not have.

Output the complete resume in markdown. Nothing else.`
}

function coverPrompt(prof: Awaited<ReturnType<typeof loadProfile>>, job: {
  title: string
  company: string
  text: string
}, resume: string) {
  const { p } = prof
  const topExp = prof.experience[0]
    ? `${prof.experience[0].title} at ${prof.experience[0].company}`
    : 'GIS analyst roles'
  const portfolio = p.portfolio_url || PORTFOLIO_FALLBACK
  const coreSkills = Object.values((p.skills ?? {}) as Record<string, string[]>)
    .flat()
    .slice(0, 8)
    .join(', ')

  return `Write a cover letter for this job application.

## TARGET JOB
Title: ${job.title}
Company: ${job.company}
Description:
${job.text}

## CANDIDATE
Name: ${p.name}
Location: ${p.location ?? ''}
Email: ${p.email ?? ''}
Most recent role: ${topExp}
Core skills: ${coreSkills}
Career summary: ${p.summary ?? ''}

Resume highlights:
${resume.slice(0, 800)}

## CANDIDATE PORTFOLIO
${portfolio}

## INSTRUCTIONS
1. Open with a specific, compelling hook — reference something real about the company or the role.
2. Connect 2-3 concrete experiences from the candidate's background to explicit needs in the JD.
3. Show genuine interest in the company's work — not just "any GIS job".
4. Naturally include the portfolio URL near the end: "You can explore more of my work at ${portfolio}"
5. Close confidently: express interest in next steps without begging.
6. Tone: professional but warm. First-person. Active voice. No fluff.
7. Length: 3-4 short paragraphs. No headers. Plain text, not markdown.
8. Do not include address blocks or dates. End with "Best,\\n${p.name}".

Output only the cover letter. Nothing else.`
}

const RESUME_SYSTEM = `You are an expert technical resume writer specializing in GIS, geospatial, and UAS careers.
You write clean, ATS-optimized, truthful resumes in markdown format.
You tailor each resume to match the specific job description's keywords and requirements.
Never invent credentials, certifications, or experience the candidate does not have.`

const COVER_SYSTEM = `You are an expert career coach writing compelling, authentic cover letters for GIS professionals.
Your letters sound human — conversational but professional, confident without being arrogant.
You connect the candidate's specific experience to the employer's actual needs.
Never use clichés like "I am writing to express my interest" or "I would be a great fit".`

// ── Handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  let payload: { url?: string; jobText?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }

  // Resolve the job description text: prefer pasted text, else fetch URL.
  let jobText = (payload.jobText ?? '').trim()
  if (!jobText && payload.url) {
    const fetched = await fetchJobText(payload.url)
    if (!fetched) {
      return json({
        needsPaste: true,
        message:
          "Couldn't read that page automatically (the site likely blocks bots or renders with JavaScript). Paste the job description text instead.",
      })
    }
    jobText = fetched
  }
  if (!jobText) return json({ error: 'Provide a url or jobText.' }, 400)

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })
    const prof = await loadProfile(db)

    // 1) Cheap metadata pass for title/company (used for filenames + prompts).
    let meta = { title: 'Role', company: 'Company' }
    try {
      const raw = await claude({
        model: META_MODEL,
        maxTokens: 200,
        prompt: `From this job posting, extract the job title and the hiring company.
Respond with ONLY compact JSON: {"title":"...","company":"..."}.
If unknown, use "Role" or "Company".

POSTING:
${jobText.slice(0, 4000)}`,
      })
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      meta = {
        title: String(parsed.title || 'Role'),
        company: String(parsed.company || 'Company'),
      }
    } catch {
      // Non-fatal — fall back to generic labels.
    }

    const job = { title: meta.title, company: meta.company, text: jobText }

    // 2) Resume, then 3) cover letter (cover letter references the resume).
    const resumeMarkdown = await claude({
      model: WRITER_MODEL,
      maxTokens: 2048,
      system: RESUME_SYSTEM,
      prompt: resumePrompt(prof, job),
    })
    const coverLetter = await claude({
      model: WRITER_MODEL,
      maxTokens: 1024,
      system: COVER_SYSTEM,
      prompt: coverPrompt(prof, job, resumeMarkdown),
    })

    return json({
      jobTitle: meta.title,
      company: meta.company,
      candidateName: prof.p.name,
      resumeMarkdown,
      coverLetter,
    })
  } catch (err) {
    return json({ error: String(err instanceof Error ? err.message : err) }, 500)
  }
})
