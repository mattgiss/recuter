import Anthropic from '@anthropic-ai/sdk'
import { USER_PROFILE } from './profile'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface JobForDocs {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  salaryRaw: string | null
  salaryMin: number | null
  salaryMax: number | null
  url: string
}

const SYSTEM = `You are an expert technical resume writer specializing in GIS and geospatial careers.
You write clean, ATS-optimized, truthful resumes in markdown format.
You tailor each resume to match the specific job description's keywords and requirements.
Never invent credentials, certifications, or experience the candidate does not have.
Use the candidate's actual experience — reframe and emphasize the most relevant aspects.`

export async function generateResume(job: JobForDocs): Promise<string> {
  const profile = USER_PROFILE
  const exp = profile.experience.map(e =>
    `### ${e.title} — ${e.company} (${e.period})
${e.highlights.map(h => `- ${h}`).join('\n')}`
  ).join('\n\n')

  const edu = profile.education.map(e =>
    `**${e.degree}** — ${e.institution}, ${e.year}`
  ).join('\n')

  const certs = profile.certifications.length
    ? profile.certifications.map(c => `- ${c}`).join('\n')
    : ''

  const prompt = `Create a customized, ATS-optimized resume for the job below.

## TARGET JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}
Description:
${job.description ?? '(no description available)'}

## CANDIDATE PROFILE

**Contact:**
${profile.name} | ${profile.location} | ${profile.email}${profile.phone ? ` | ${profile.phone}` : ''}${profile.linkedin ? ` | ${profile.linkedin}` : ''}

**Professional Summary:**
${profile.summary}

**Experience:**
${exp}

**Education:**
${edu}
${certs ? `\n**Certifications:**\n${certs}` : ''}

**Skills:**
- ESRI: ${profile.skills.esri.join(', ')}
- Open Source GIS: ${profile.skills.openSource.join(', ')}
- Programming: ${profile.skills.programming.join(', ')}
- Databases: ${profile.skills.databases.join(', ')}
- Web GIS: ${profile.skills.webGIS.join(', ')}
- Domains: ${profile.skills.domains.join(', ')}

## INSTRUCTIONS
1. Mirror keywords from the job description (ATS-critical).
2. Lead with a punchy 2-3 sentence summary that directly references the role.
3. Reorder and reframe bullet points so the most relevant experience is prominent.
4. Use strong action verbs and quantify achievements where possible.
5. Keep to 1 page worth of content (tight, no filler).
6. Output clean markdown — use ## for sections, **bold** for company/titles, - for bullets.
7. Include a "Core Competencies" section with 6-9 keywords pulled from the job description.

Output the complete resume in markdown. Nothing else.`

  let resumeText = ''

  const stream = await client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      resumeText += chunk.delta.text
    }
  }

  return resumeText.trim()
}
