import 'dotenv/config'
import { db } from '../db/client'
import { postDailyBusinessReview, type DBRStats } from './discord'

async function gatherStats(): Promise<DBRStats> {
  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const today = now.toLocaleDateString('en-US', {
    timeZone: 'America/Denver',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const [
    jobsFoundRes,
    jobsScoredRes,
    highScoringRes,
    applicationsRes,
    lastRunRes,
    topJobsRes,
    recentErrorsRes,
  ] = await Promise.all([
    // New jobs found in last 24h
    db.from('jobs').select('id', { count: 'exact', head: true }).gte('discovered_at', since24h),

    // Jobs scored in last 24h
    db.from('jobs').select('id', { count: 'exact', head: true })
      .eq('status', 'scored').gte('updated_at', since24h),

    // High-scoring jobs (7+) found in last 24h
    db.from('jobs').select('id', { count: 'exact', head: true })
      .gte('score', 7).gte('discovered_at', since24h),

    // Application pipeline counts
    db.from('applications').select('status'),

    // Last scraper run
    db.from('scraper_runs').select('status, started_at, jobs_found, error')
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),

    // Top jobs this week for the highlights section
    db.from('jobs').select('title, url, score, location, employers!inner(name)')
      .gte('score', 7)
      .gte('discovered_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('score', { ascending: false })
      .limit(5),

    // Recent scraper errors
    db.from('scraper_runs').select('error, started_at')
      .not('error', 'is', null)
      .gte('started_at', since24h)
      .limit(3),
  ])

  const appsByStatus: Record<string, number> = {}
  for (const row of (applicationsRes.data ?? [])) {
    const s = row.status as string
    appsByStatus[s] = (appsByStatus[s] ?? 0) + 1
  }

  const queued = (appsByStatus['queued'] ?? 0) + (appsByStatus['draft'] ?? 0)
  const applied = Object.entries(appsByStatus)
    .filter(([k]) => ['submitted', 'applied', 'acknowledged', 'screening', 'phone_screen', 'interview', 'offer'].includes(k))
    .reduce((sum, [, v]) => sum + v, 0)
  const total = Object.values(appsByStatus).reduce((a, b) => a + b, 0)

  const topJobs = (topJobsRes.data ?? []).map((row: Record<string, unknown>) => ({
    title: row.title as string,
    company: (row.employers as Record<string, unknown>)?.name as string ?? '',
    score: row.score as number,
    location: row.location as string | null,
    url: row.url as string,
  }))

  const scraperErrors = (recentErrorsRes.data ?? [])
    .map(r => `${new Date(r.started_at as string).toLocaleTimeString('en-US', { timeZone: 'America/Denver' })}: ${r.error}`)

  const lastRun = lastRunRes.data
  return {
    date: today,
    jobsFoundToday: jobsFoundRes.count ?? 0,
    jobsScoredToday: jobsScoredRes.count ?? 0,
    highScoringToday: highScoringRes.count ?? 0,
    applicationsQueued: queued,
    applicationsApplied: applied,
    applicationsTotal: total,
    lastScrapeStatus: lastRun?.status ?? 'unknown',
    lastScrapeTime: lastRun?.started_at ?? null,
    lastScrapeJobsFound: lastRun?.jobs_found ?? 0,
    topJobs,
    scraperErrors,
  }
}

async function main() {
  console.log('[dbr] Gathering stats...')

  try {
    const stats = await gatherStats()
    console.log(`[dbr] ${stats.date} — ${stats.jobsFoundToday} jobs found today, ${stats.highScoringToday} high-scoring`)
    await postDailyBusinessReview(stats)
    console.log('[dbr] Posted to Discord ✓')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[dbr] Failed: ${msg}`)
    process.exit(1)
  }
}

main()
