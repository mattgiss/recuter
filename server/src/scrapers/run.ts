import 'dotenv/config'
import { SEARCH } from '../config'
import { scrapeUSAJobs } from './usajobs'
import { scrapeIndeed } from './indeed'
import { scrapeLinkedIn } from './linkedin'
import { upsertEmployer, saveJob, startScraperRun, finishScraperRun } from '../db/helpers'
import type { ScrapedJob } from './types'

interface SourceResult {
  source: string
  jobs: ScrapedJob[]
  error?: string
}

async function runScraper(
  name: string,
  fn: () => Promise<ScrapedJob[]>
): Promise<SourceResult> {
  console.log(`\n[${name}] Starting...`)
  try {
    const jobs = await fn()
    console.log(`[${name}] Found ${jobs.length} listings`)
    return { source: name, jobs }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[${name}] Failed: ${error}`)
    return { source: name, jobs: [], error }
  }
}

async function persist(jobs: ScrapedJob[], runId: string): Promise<{ saved: number; dupes: number }> {
  let saved = 0
  let dupes = 0

  for (const job of jobs) {
    try {
      const employerId = await upsertEmployer(job.company)
      const { isNew } = await saveJob(job, employerId, runId)
      if (isNew) {
        saved++
        console.log(`  + [${job.source}] ${job.title} @ ${job.company}`)
      } else {
        dupes++
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  ! Failed to save "${job.title}": ${msg}`)
    }
  }

  return { saved, dupes }
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — job discovery run')
  console.log(`  Target: GIS roles | Denver/Remote | $${(SEARCH.salaryMinGross / 1000).toFixed(0)}k+ gross`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const runId = await startScraperRun('all')

  const results = await Promise.allSettled([
    runScraper('usajobs', () =>
      scrapeUSAJobs(SEARCH.keywords, SEARCH.salaryMinGross)
    ),
    runScraper('indeed', () =>
      scrapeIndeed(SEARCH.keywords, SEARCH.locations[0], SEARCH.salaryMinGross)
    ),
    runScraper('linkedin', () =>
      scrapeLinkedIn(SEARCH.keywords)
    ),
  ])

  const allJobs: ScrapedJob[] = []
  const errors: string[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value.jobs)
      if (result.value.error) errors.push(`${result.value.source}: ${result.value.error}`)
    } else {
      errors.push(String(result.reason))
    }
  }

  console.log(`\n[persist] Saving ${allJobs.length} total listings to database...`)
  const { saved, dupes } = await persist(allJobs, runId)

  await finishScraperRun(runId, {
    jobsFound: allJobs.length,
    jobsNew: saved,
    error: errors.length ? errors.join('; ') : undefined,
  })

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`  Done.`)
  console.log(`  Total found : ${allJobs.length}`)
  console.log(`  New saved   : ${saved}`)
  console.log(`  Duplicates  : ${dupes}`)
  if (errors.length) console.log(`  Errors      : ${errors.join(', ')}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
