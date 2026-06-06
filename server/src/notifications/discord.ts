import axios from 'axios'

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL

// Recuter's identity on every message — shown via the webhook username + avatar.
const AVATAR_URL =
  process.env.RECUTER_AVATAR_URL ??
  'https://raw.githubusercontent.com/mattgiss/recuter/main/assets/recuter-avatar.png'
const IDENTITY = { username: 'Recuter', avatar_url: AVATAR_URL }

// Subtle accent stripe on the left of each post (cyberpunk cyan / magenta).
const CYAN = 0x3fe9ff
const MAGENTA = 0xff3bd4

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface Post {
  text: string
  // optional clickable headline
  title?: string
  url?: string
  color?: number
}

/**
 * Post a short "thread" to the Discord forum, Bluesky/Threads style:
 * the first post opens the forum thread, the rest land as quick replies
 * in that same thread a beat later.
 */
async function postThread(threadName: string, posts: Post[]): Promise<void> {
  if (!WEBHOOK || posts.length === 0) return
  const headers = { 'Content-Type': 'application/json' }

  const toEmbed = (p: Post) => ({
    ...(p.title ? { title: p.title } : {}),
    ...(p.url ? { url: p.url } : {}),
    description: p.text,
    color: p.color ?? CYAN,
  })

  // First post creates the forum thread.
  const first = await axios.post(
    `${WEBHOOK}?wait=true`,
    { ...IDENTITY, thread_name: threadName.slice(0, 100), embeds: [toEmbed(posts[0])] },
    { headers }
  )

  const threadId: string | undefined = first.data?.channel_id
  if (!threadId) return

  // Remaining posts reply into the same thread, like a Threads chain.
  for (const p of posts.slice(1)) {
    await sleep(700)
    await axios.post(
      `${WEBHOOK}?wait=true&thread_id=${threadId}`,
      { ...IDENTITY, embeds: [toEmbed(p)] },
      { headers }
    )
  }
}

function opener(score: number): string {
  if (score >= 9) return "okay, this one's basically you on paper."
  if (score >= 8) return "found one i think you'll actually like."
  return 'spotted something worth a look.'
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

/** Tell Matt about a role, like a quick chain of casual posts. */
export async function notifyNewJob(job: JobNotification): Promise<void> {
  if (!WEBHOOK) return

  const pay =
    job.salaryRaw ??
    (job.salaryMin
      ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? `–$${job.salaryMax.toLocaleString()}` : '+'}`
      : null)

  const payLine = pay ? `pay's around ${pay}. ` : 'no salary posted, but i can ask. '

  const posts: Post[] = [
    {
      title: `${job.title} at ${job.company}`,
      url: job.url,
      text: `${opener(job.score)}${job.location ? ` it's in ${job.location}.` : ''}`,
      color: job.score >= 9 ? MAGENTA : CYAN,
    },
    { text: `why it caught my eye — ${job.reasoning.slice(0, 900)}` },
    { text: `${payLine}already drafted your resume and cover letter. want me to send it?` },
  ]

  await postThread(`${job.title} at ${job.company}`, posts)
}

/** Ping when applications are filled in and waiting for the user's submit. */
export async function notifyReadyToApply(
  items: Array<{ jobTitle: string; company: string; jobUrl: string }>
): Promise<void> {
  if (!WEBHOOK || items.length === 0) return

  const n = items.length
  const lead =
    n === 1
      ? 'prepped an application for you — filled in and ready. just need your ok to hit submit.'
      : `prepped ${n} applications for you — all filled in and ready. just need your ok to hit submit.`

  const list = items.map(i => `• [${i.jobTitle} at ${i.company}](${i.jobUrl})`).join('\n')

  await postThread('ready for your ok', [{ text: lead }, { text: list }])
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

/** A short, casual morning check-in — posted as a little thread. */
export async function postDailyBusinessReview(stats: DBRStats): Promise<void> {
  if (!WEBHOOK) {
    console.error('[discord] DISCORD_WEBHOOK_URL not set — cannot post the morning note')
    return
  }

  let lead: string
  if (stats.highScoringToday >= 3) {
    lead = `morning. good night for it — i found ${stats.highScoringToday} roles i think you'll like.`
  } else if (stats.highScoringToday >= 1) {
    lead = `morning. found ${stats.highScoringToday} role${stats.highScoringToday > 1 ? 's' : ''} worth your time while you slept.`
  } else if (stats.jobsFoundToday > 0) {
    lead = `morning. went through ${stats.jobsFoundToday} new postings overnight — nothing strong enough to flag yet. holding out for the right ones.`
  } else {
    lead = `morning. quiet night, no new postings came through. still watching.`
  }

  const posts: Post[] = [{ text: lead }]

  if (stats.topJobs.length) {
    const list = stats.topJobs
      .map(j => `• [${j.title} at ${j.company}](${j.url})${j.location ? ` — ${j.location}` : ''}`)
      .join('\n')
    posts.push({ text: `worth a look:\n${list}` })
  }

  const bits: string[] = []
  if (stats.applicationsApplied > 0)
    bits.push(`${stats.applicationsApplied} application${stats.applicationsApplied > 1 ? 's' : ''} out`)
  if (stats.applicationsQueued > 0) bits.push(`${stats.applicationsQueued} ready for your ok`)
  if (bits.length) posts.push({ text: `where things stand: ${bits.join(', ')}.` })

  if (stats.scraperErrors.length) {
    posts.push({
      text: "heads up — had trouble reaching one of the job boards overnight. i'll retry automatically, nothing for you to do.",
    })
  }

  await postThread(`morning — ${stats.date}`, posts)
}
