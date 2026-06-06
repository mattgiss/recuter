import axios from 'axios'

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL

// Recuter's identity on every message — a friendly companion, not a build log.
const AVATAR_URL =
  process.env.RECUTER_AVATAR_URL ??
  'https://raw.githubusercontent.com/mattgiss/recuter/main/assets/recuter-avatar.png'
const IDENTITY = { username: 'Recuter', avatar_url: AVATAR_URL }

// Recuter's signature palette (cyberpunk cyan → magenta)
const CYAN = 0x3fe9ff
const VIOLET = 0x7a3bff
const MAGENTA = 0xff3bd4
const SUNRISE = 0xffb454

/** Translate an internal 1–10 score into warm, human language. No numbers leak out. */
function matchFeel(score: number): { label: string; color: number; opener: string } {
  if (score >= 9)
    return {
      label: '💫 Perfect fit',
      color: MAGENTA,
      opener: "Okay, I had to stop and tell you about this one — it's *you* on paper.",
    }
  if (score >= 8)
    return {
      label: '✨ Excellent fit',
      color: VIOLET,
      opener: "I found something I think you're going to really like.",
    }
  return {
    label: '⭐ Strong fit',
    color: CYAN,
    opener: "Spotted a role worth a look — it lines up nicely with your strengths.",
  }
}

export interface JobNotification {
  id: string
  title: string
  company: string
  location: string | null
  score: number
  reasoning: string
  url: string
  salaryRaw: string | null
  salaryMin: number | null
  salaryMax: number | null
  source: string
}

/** Tell Matt — like a friend would — about a role I found and prepped for him. */
export async function notifyNewJob(job: JobNotification): Promise<void> {
  if (!WEBHOOK) return

  const feel = matchFeel(job.score)

  const pay =
    job.salaryRaw ??
    (job.salaryMin
      ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? `–$${job.salaryMax.toLocaleString()}` : '+'}`
      : 'Not posted (I can ask)')

  await axios.post(
    `${WEBHOOK}?wait=true`,
    {
      ...IDENTITY,
      thread_name: `${feel.label} — ${job.title} at ${job.company}`,
      embeds: [
        {
          author: { name: 'Recuter', icon_url: AVATAR_URL },
          title: `${job.title} · ${job.company}`,
          url: job.url,
          color: feel.color,
          description:
            `${feel.opener}\n\n` +
            `**${job.company}** is hiring a **${job.title}**${job.location ? ` in ${job.location}` : ''}, ` +
            `and I've already drafted a tailored résumé and cover letter for you.`,
          fields: [
            { name: '💰 Pay', value: pay, inline: true },
            { name: '📍 Where', value: job.location ?? 'Flexible / Remote', inline: true },
            { name: '💭 Why I picked this for you', value: job.reasoning.slice(0, 1000), inline: false },
          ],
          footer: { text: "Your résumé & cover letter are ready — just say the word and I'll apply." },
          timestamp: new Date().toISOString(),
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' } }
  )
}

export interface DBRStats {
  date: string
  jobsFoundToday: number
  jobsScoredToday: number
  highScoringToday: number
  applicationsQueued: number
  applicationsApplied: number
  applicationsTotal: number
  lastScrapeStatus: string
  lastScrapeTime: string | null
  lastScrapeJobsFound: number
  topJobs: Array<{ title: string; company: string; score: number; location: string | null; url: string }>
  scraperErrors: string[]
}

/** A warm morning check-in from Recuter — the day's job search, in plain language. */
export async function postDailyBusinessReview(stats: DBRStats): Promise<void> {
  if (!WEBHOOK) {
    console.error('[discord] DISCORD_WEBHOOK_URL not set — cannot post the morning note')
    return
  }

  // Lead line adapts to how the search is going — never robotic.
  let lead: string
  if (stats.highScoringToday >= 3) {
    lead = `Good morning ☀️ It was a strong night — I found **${stats.highScoringToday} roles** I think you'll genuinely like.`
  } else if (stats.highScoringToday >= 1) {
    lead = `Good morning ☀️ I found **${stats.highScoringToday}** role${stats.highScoringToday > 1 ? 's' : ''} worth your time while you slept.`
  } else if (stats.jobsFoundToday > 0) {
    lead = `Good morning ☀️ I went through **${stats.jobsFoundToday}** new openings overnight. Nothing was a strong-enough fit to bother you with yet — I'm holding out for the right ones.`
  } else {
    lead = `Good morning ☀️ Quiet night on the boards — no new openings came through. I'll keep watching today.`
  }

  // Friendly summary sentence about what's in flight.
  const pipelineBits: string[] = []
  if (stats.applicationsApplied > 0) pipelineBits.push(`**${stats.applicationsApplied}** application${stats.applicationsApplied > 1 ? 's' : ''} out the door`)
  if (stats.applicationsQueued > 0) pipelineBits.push(`**${stats.applicationsQueued}** ready for your go-ahead`)
  const pipelineLine = pipelineBits.length
    ? `Where things stand: ${pipelineBits.join(' · ')}.`
    : `Nothing in flight yet — once you give me the nod, I'll start sending applications.`

  const topJobsText = stats.topJobs.length
    ? stats.topJobs
        .map(j => `• **[${j.title} at ${j.company}](${j.url})**${j.location ? ` — ${j.location}` : ''}`)
        .join('\n')
    : "_Nothing to highlight today — I only surface roles I'd actually stake my reputation on._"

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: '📋 Your search, right now', value: pipelineLine, inline: false },
    { name: '🌟 Worth a look', value: topJobsText, inline: false },
  ]

  // If a board was unreachable, mention it gently — no stack traces, no jargon.
  if (stats.scraperErrors.length) {
    fields.push({
      name: '🔧 Heads up',
      value: "I had trouble reaching one of the job boards overnight. No worries — I'll automatically try again. Nothing for you to do.",
      inline: false,
    })
  }

  const color = stats.highScoringToday >= 1 ? SUNRISE : CYAN

  await axios.post(
    `${WEBHOOK}?wait=true`,
    {
      ...IDENTITY,
      thread_name: `☀️ Your morning briefing — ${stats.date}`,
      embeds: [
        {
          author: { name: 'Recuter', icon_url: AVATAR_URL },
          title: `Your morning briefing · ${stats.date}`,
          color,
          description: `${lead}`,
          fields,
          footer: { text: "I'm on it around the clock. Talk soon — Recuter" },
          timestamp: new Date().toISOString(),
        },
      ],
    },
    { headers: { 'Content-Type': 'application/json' } }
  )
}
