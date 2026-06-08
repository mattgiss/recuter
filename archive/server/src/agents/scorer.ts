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
Skills: ${Object.values(USER_PROFILE.skills).flat().join(', ')}
Deal breakers: ${USER_PROFILE.dealBreakers.join('; ')}

NOTE: The candidate is transitioning into GIS from a strong technical
program-management background, with FAA Part 107 / drone mapping, remote
sensing, and a GIS graduate certificate in progress. Score entry- and mid-level
GIS, geospatial, UAS/drone, and remote-sensing roles favorably, and credit
transferable data-pipeline, QA, and cross-functional experience. Don't penalize
a role just for being entry/mid-level or not requiring a senior GIS engineer.

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
10  — Perfect match: GIS/geospatial/UAS/remote-sensing role at entry/mid level, right salary, strong fit with the candidate's skills
8-9 — Strong match: clear GIS/geospatial/UAS role with minor gaps (salary unlisted, or leans senior but reachable)
6-7 — Decent match: partial GIS/geospatial component, or transferable (data/QA/PM) role adjacent to geospatial; worth applying
4-5 — Weak match: only a faint GIS/geospatial mention, mostly unrelated IT/admin, or salary likely too low
1-3 — Poor match: no GIS/geospatial/UAS component at all, deal breaker present, or clear mismatch

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
