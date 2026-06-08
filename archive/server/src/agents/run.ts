import 'dotenv/config'
import { AUTO_APPLY_SCORE_THRESHOLD } from '../config'
import { initProfile } from './profile'
import { scoreJob } from './scorer'
import { generateResume } from './resume-generator'
import { generateCoverLetter } from './cover-letter'
import {
  getUnscoredJobs,
  updateJobScore,
  updateJobStatus,
  getQueuedJobs,
  createApplication,
  saveResume,
  saveCoverLetter,
  linkApplicationDocuments,
} from '../db/helpers'
import type { JobForDocs } from './resume-generator'

const RATE_LIMIT_MS = 2_000  // pause between Claude API calls

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toJobForDocs(row: Awaited<ReturnType<typeof getUnscoredJobs>>[number]): JobForDocs {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    description: row.description,
    salaryRaw: row.salary_raw,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    url: row.url,
  }
}

async function runScoring() {
  const jobs = await getUnscoredJobs()

  if (jobs.length === 0) {
    console.log('[score] No new jobs to score.')
    return
  }

  console.log(`[score] Scoring ${jobs.length} jobs...`)
  let scored = 0
  let skipped = 0

  for (const job of jobs) {
    try {
      process.stdout.write(`  [${job.source}] ${job.title} @ ${job.company} ... `)

      await updateJobStatus(job.id, 'scoring')
      const result = await scoreJob({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        salaryMin: job.salary_min,
        salaryMax: job.salary_max,
        salaryRaw: job.salary_raw,
        description: job.description,
        source: job.source,
        url: job.url,
      })

      await updateJobScore(job.id, result.score, result.reasoning)
      console.log(`${result.score}/10`)
      scored++

      if (result.score >= AUTO_APPLY_SCORE_THRESHOLD) {
        // (notifications removed)
      } else {
        await updateJobStatus(job.id, 'skipped')
        skipped++
      }

      await sleep(RATE_LIMIT_MS)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`ERROR — ${msg}`)
      await updateJobStatus(job.id, 'new').catch(() => {})
    }
  }

  const queued = scored - skipped
  console.log(`\n[score] Done. ${scored} scored, ${queued} queued for applications, ${skipped} skipped.`)
}

async function runDocumentGeneration() {
  const jobs = await getQueuedJobs(AUTO_APPLY_SCORE_THRESHOLD)

  if (jobs.length === 0) {
    console.log('[docs] No scored jobs waiting for documents.')
    return
  }

  console.log(`[docs] Generating documents for ${jobs.length} jobs...`)

  for (const job of jobs) {
    console.log(`\n  [${job.source}] ${job.title} @ ${job.company}`)

    try {
      const jobForDocs = toJobForDocs(job)

      process.stdout.write('    → creating application record ... ')
      const applicationId = await createApplication(job.id, job.employer_id)
      console.log('done')

      process.stdout.write('    → generating resume ... ')
      const resumeContent = await generateResume(jobForDocs)
      const resumeId = await saveResume(job.id, applicationId, resumeContent)
      console.log(`done (${resumeContent.length} chars)`)
      await sleep(RATE_LIMIT_MS)

      process.stdout.write('    → generating cover letter ... ')
      const letterContent = await generateCoverLetter(jobForDocs, resumeContent)
      const coverLetterId = await saveCoverLetter(job.id, applicationId, letterContent)
      console.log(`done (${letterContent.length} chars)`)

      await linkApplicationDocuments(applicationId, resumeId, coverLetterId)
      await updateJobStatus(job.id, 'queued')

      console.log(`    ✓ Application ${applicationId} ready`)
      await sleep(RATE_LIMIT_MS)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    ERROR — ${msg}`)
    }
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in .env')
    process.exit(1)
  }

  await initProfile()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — AI scoring & document generation')
  console.log(`  Threshold: ${AUTO_APPLY_SCORE_THRESHOLD}/10 to queue`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const mode = process.argv[2]

  if (!mode || mode === 'all') {
    await runScoring()
    console.log()
    await runDocumentGeneration()
  } else if (mode === 'score') {
    await runScoring()
  } else if (mode === 'docs') {
    await runDocumentGeneration()
  } else {
    console.error(`Unknown mode: ${mode}. Use: score | docs | all`)
    process.exit(1)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Done.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
