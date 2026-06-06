import axios from 'axios'

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL

function scoreColor(score: number): number {
  if (score >= 9) return 0x57f287   // green
  if (score >= 7) return 0xfee75c   // yellow
  if (score >= 5) return 0xeb459e   // pink
  return 0xed4245                   // red
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

/** Post a new high-scoring job match as a Discord forum thread. */
export async function notifyNewJob(job: JobNotification): Promise<void> {
  if (!WEBHOOK) return

  const salary = job.salaryRaw
    ?? (job.salaryMin
      ? `$${job.salaryMin.toLocaleString()}${job.salaryMax ? `–$${job.salaryMax.toLocaleString()}` : '+'}`
      : 'Not listed')

  const scoreBar = '█'.repeat(job.score) + '░'.repeat(10 - job.score)

  await axios.post(`${WEBHOOK}?wait=true`, {
    thread_name: `🎯 ${job.score}/10 — ${job.title} @ ${job.company}`,
    embeds: [{
      title: `${job.title}`,
      url: job.url,
      color: scoreColor(job.score),
      description: `**${job.company}** · ${job.location ?? 'Location not listed'}`,
      fields: [
        { name: 'Fit Score', value: `\`${scoreBar}\` **${job.score}/10**`, inline: false },
        { name: 'Salary', value: salary, inline: true },
        { name: 'Source', value: job.source.toUpperCase(), inline: true },
        { name: 'Why this fits', value: job.reasoning.slice(0, 1000), inline: false },
      ],
      footer: { text: 'recuter auto-discovery • resume + cover letter generated' },
      timestamp: new Date().toISOString(),
    }],
  }, { headers: { 'Content-Type': 'application/json' } })
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

/** Post the daily business review as a Discord forum thread. */
export async function postDailyBusinessReview(stats: DBRStats): Promise<void> {
  if (!WEBHOOK) {
    console.error('[discord] DISCORD_WEBHOOK_URL not set — cannot post DBR')
    return
  }

  const statusIcon = (s: string) => s === 'completed' ? '✅' : s === 'running' ? '🔄' : '❌'
  const topJobsText = stats.topJobs.length
    ? stats.topJobs.map((j, i) => `${i + 1}. **[${j.title} @ ${j.company}](${j.url})** — ${j.score}/10 · ${j.location ?? 'Remote/TBD'}`).join('\n')
    : '_No high-scoring jobs found yet_'

  const scrapeTime = stats.lastScrapeTime
    ? new Date(stats.lastScrapeTime).toLocaleTimeString('en-US', { timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit' })
    : 'Never'

  const color = stats.highScoringToday >= 3 ? 0x57f287 : stats.highScoringToday >= 1 ? 0xfee75c : 0x5865f2

  await axios.post(`${WEBHOOK}?wait=true`, {
    thread_name: `📊 Daily Review — ${stats.date} — ${stats.highScoringToday} high-scoring jobs`,
    embeds: [{
      title: `📊 Daily Business Review — ${stats.date}`,
      color,
      fields: [
        {
          name: '📡 Pipeline Status',
          value: `${statusIcon(stats.lastScrapeStatus)} Last scrape: **${scrapeTime} MDT** · ${stats.lastScrapeJobsFound} listings found`,
          inline: false,
        },
        {
          name: '🔍 Discovery (last 24h)',
          value: `Found: **${stats.jobsFoundToday}** · Scored: **${stats.jobsScoredToday}** · High match (7+): **${stats.highScoringToday}**`,
          inline: false,
        },
        {
          name: '📋 Application Pipeline',
          value: `Queued: **${stats.applicationsQueued}** · Applied: **${stats.applicationsApplied}** · Total: **${stats.applicationsTotal}**`,
          inline: false,
        },
        {
          name: '🏆 Top Matches',
          value: topJobsText,
          inline: false,
        },
        ...(stats.scraperErrors.length ? [{
          name: '⚠️ Errors',
          value: stats.scraperErrors.join('\n').slice(0, 1000),
          inline: false,
        }] : []),
      ],
      footer: { text: 'recuter • automated job search & application system' },
      timestamp: new Date().toISOString(),
    }],
  }, { headers: { 'Content-Type': 'application/json' } })
}
