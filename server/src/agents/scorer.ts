import Anthropic from '@anthropic-ai/sdk'
import { USER_PROFILE } from './profile'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface JobToScore {
  id: string
  title: string
  company: string
  location: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryRaw: string | null
  description: string | null
  source: string
  url: string
}

export interface ScoreResult {
  score: number
  reasoning: string
}

const SYSTEM = `You are a job-fit analyst helping a GIS professional evaluate job listings.
You score each listing 1-10 based on how well it matches the candidate's profile, skills, and salary targets.
You return only valid JSON — no markdown, no explanation outside the JSON.`

export async function scoreJob(job: JobToScore): Promise<ScoreResult> {
  const salaryDisplay = job.salaryRaw
    ?? (job.salaryMin ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? ` – $${job.salaryMax.toLocaleString()}` : '+'}` : 'Not listed')

  const prompt = `Score this job listing for fit with the candidate profile below.

## CANDIDATE PROFILE
Name: ${USER_PROFILE.name}
Location: ${USER_PROFILE.location} (willing to relocate: ${USER_PROFILE.willingToRelocate})
Target roles: ${USER_PROFILE.targetRoles.join(', ')}
Salary target: $${USER_PROFILE.targetSalaryGrossMin.toLocaleString()}+ gross
Summary: ${USER_PROFILE.summary}
GIS Tools: ${USER_PROFILE.skills.esri.concat(USER_PROFILE.skills.openSource).join(', ')}
Programming: ${USER_PROFILE.skills.programming.join(', ')}
Domains: ${USER_PROFILE.skills.domains.join(', ')}
Deal breakers: ${USER_PROFILE.dealBreakers.join('; ')}

## JOB LISTING
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}
Salary: ${salaryDisplay}
Source: ${job.source}
URL: ${job.url}
Description:
${job.description ?? '(no description available)'}

## SCORING RUBRIC
10  — Perfect match: GIS-specific role, right salary, strong company, aligns with candidate's top skills
8-9 — Strong match: GIS role with minor gaps (salary unlisted but likely fine, or adjacent domain)
6-7 — Decent match: partial GIS component or salary borderline; worth applying if time allows
4-5 — Weak match: vague GIS mention, mostly IT/admin, or salary likely too low
1-3 — Poor match: no real GIS work, deal breaker present, or clear mismatch

## OUTPUT
Return ONLY valid JSON, no other text:
{"score": <integer 1-10>, "reasoning": "<2-3 sentence explanation of the score>"}`

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 512,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in scorer response')
  }

  let parsed: ScoreResult
  try {
    parsed = JSON.parse(textBlock.text.trim())
  } catch {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error(`Could not parse scorer JSON: ${textBlock.text}`)
    parsed = JSON.parse(jsonMatch[0])
  }

  if (typeof parsed.score !== 'number' || parsed.score < 1 || parsed.score > 10) {
    throw new Error(`Invalid score value: ${parsed.score}`)
  }

  return { score: Math.round(parsed.score), reasoning: parsed.reasoning }
}
