import Anthropic from '@anthropic-ai/sdk'
import { USER_PROFILE } from './profile'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ReplyType =
  | 'interview_request'
  | 'screening_questions'
  | 'scheduling'
  | 'recruiter_outreach'
  | 'rejection'
  | 'offer'
  | 'other'

export interface DraftedReply {
  type: ReplyType
  senderName: string
  company: string
  summary: string
  draft: string
}

export interface ReplyInput {
  fromAddress: string
  subject: string
  body: string
  jobTitle?: string | null
}

const SYSTEM = `You are an assistant that reads recruiter/hiring emails and drafts replies in the
candidate's own voice. You classify the email, then write a reply the candidate can review and send.
You return only valid JSON. You never invent facts, dates, or commitments — when the candidate must
decide something (an exact time, a salary number), you leave a [bracketed note] in the draft.`

export async function draftReply(input: ReplyInput): Promise<DraftedReply> {
  const p = USER_PROFILE
  const prompt = `Read this incoming email and draft a reply in the candidate's voice.

## CANDIDATE
Name: ${p.name}
Background: ${p.summary}
Applied for: ${input.jobTitle ?? '(unknown — infer from the email if possible)'}
Voice & rules:
${p.voice.guidelines}
Availability to offer for interviews: ${p.voice.availability}
Sign every email with:
${p.voice.signoff}

## INCOMING EMAIL
From: ${input.fromAddress}
Subject: ${input.subject}
Body:
${input.body.slice(0, 8000)}

## CLASSIFY
type is one of: interview_request, screening_questions, scheduling, recruiter_outreach, rejection, offer, other

## OUTPUT
Return ONLY valid JSON, no other text:
{
  "type": "<one of the types>",
  "senderName": "<the person's name, or their company if unknown>",
  "company": "<company name if identifiable, else empty string>",
  "summary": "<one sentence: what they want / what this is>",
  "draft": "<the full reply email body in the candidate's voice, greeting through sign-off>"
}`

  const res = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = res.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in reply-writer response')

  let parsed: DraftedReply
  try {
    parsed = JSON.parse(textBlock.text.trim())
  } catch {
    const m = textBlock.text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error(`Could not parse reply JSON: ${textBlock.text.slice(0, 200)}`)
    parsed = JSON.parse(m[0])
  }
  return parsed
}
