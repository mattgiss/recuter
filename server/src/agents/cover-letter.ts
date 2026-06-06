import Anthropic from '@anthropic-ai/sdk'
import { USER_PROFILE } from './profile'
import type { JobForDocs } from './resume-generator'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM = `You are an expert career coach writing compelling, authentic cover letters for GIS professionals.
Your letters sound human — conversational but professional, confident without being arrogant.
You connect the candidate's specific experience to the employer's actual needs.
Never use clichés like "I am writing to express my interest" or "I would be a great fit".
Each letter is unique and tailored — not a template with blanks filled in.`

export async function generateCoverLetter(job: JobForDocs, resumeContent?: string): Promise<string> {
  const profile = USER_PROFILE

  const topExp = profile.experience[0]
    ? `${profile.experience[0].title} at ${profile.experience[0].company}`
    : 'GIS analyst roles'

  const portfolioUrl = process.env.PORTFOLIO_URL ?? 'https://mattgiss.github.io/recuter/portfolio/'

  const prompt = `Write a cover letter for this job application.

## TARGET JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location ?? 'Not specified'}
URL: ${job.url}
Description:
${job.description ?? '(no description available)'}

## CANDIDATE
Name: ${profile.name}
Location: ${profile.location}
Email: ${profile.email}
Most recent role: ${topExp}
Core GIS skills: ${profile.skills.esri.slice(0, 4).join(', ')}, Python, PostGIS
Career summary: ${profile.summary}
${resumeContent ? `\nResume highlights:\n${resumeContent.slice(0, 800)}` : ''}

## CANDIDATE PORTFOLIO
${portfolioUrl}

## INSTRUCTIONS
1. Open with a specific, compelling hook — reference something real about the company or the role.
2. Connect 2-3 concrete experiences from the candidate's background to explicit needs in the JD.
3. Show genuine interest in the company's work — not just "any GIS job".
4. Naturally include the portfolio URL near the end: "You can explore more of my work at ${portfolioUrl}"
5. Close confidently: express interest in next steps without begging.
6. Tone: professional but warm. First-person. Active voice. No fluff.
7. Length: 3-4 short paragraphs. No headers. Plain text, not markdown.
8. Do not include address blocks, dates, or "Sincerely" — just the body paragraphs.

Output only the cover letter body. Nothing else.`

  let letterText = ''

  const stream = await client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      letterText += chunk.delta.text
    }
  }

  return letterText.trim()
}
