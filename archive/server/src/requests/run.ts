import 'dotenv/config'
import { initProfile } from '../agents/profile'
import { generateResume } from '../agents/resume-generator'
import { generateCoverLetter } from '../agents/cover-letter'
import type { JobForDocs } from '../agents/resume-generator'
import {
  getPendingApplyRequests,
  markApplyRequestDone,
  getJobById,
  jobHasApplicationWithResume,
  createApplication,
  saveResume,
  saveCoverLetter,
  linkApplicationDocuments,
  updateJobStatus,
} from '../db/helpers'

const RATE_LIMIT_MS = 2_000
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function toJobForDocs(job: Awaited<ReturnType<typeof getJobById>>): JobForDocs {
  if (!job) throw new Error('null job')
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    salaryRaw: job.salary_raw,
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    url: job.url,
  }
}

/**
 * Processes "Apply" requests submitted from the board: for each pending
 * request, makes sure the job has a tailored résumé + cover letter and is
 * marked `queued`, so the review-first `npm run apply` run will pick it up.
 */
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in .env')
    process.exit(1)
  }

  await initProfile()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — apply requests from the board')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const requests = await getPendingApplyRequests()
  if (requests.length === 0) {
    console.log('[requests] Nothing requested from the board right now.')
    return
  }
  console.log(`[requests] ${requests.length} apply request(s) to process.\n`)

  let queued = 0
  for (const req of requests) {
    try {
      const job = await getJobById(req.jobId)
      if (!job) {
        console.log(`  ✗ job ${req.jobId} not found — skipping`)
        await markApplyRequestDone(req.id, 'error', 'job not found')
        continue
      }

      console.log(`  • ${job.title} @ ${job.company}`)

      // If docs already exist, just make sure it's queued for the apply run.
      if (await jobHasApplicationWithResume(req.jobId)) {
        await updateJobStatus(req.jobId, 'queued')
        await markApplyRequestDone(req.id, 'queued', 'already had documents')
        console.log('    → already prepared; queued ✓')
        queued++
        continue
      }

      // Otherwise generate the tailored documents now, then queue.
      const jobForDocs = toJobForDocs(job)

      process.stdout.write('    → creating application ... ')
      const applicationId = await createApplication(job.id, job.employer_id)
      console.log('done')

      process.stdout.write('    → generating résumé ... ')
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
      await markApplyRequestDone(req.id, 'queued')
      console.log('    → queued for the apply run ✓')
      queued++
      await sleep(RATE_LIMIT_MS)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    ✗ error — ${msg}`)
      await markApplyRequestDone(req.id, 'error', msg).catch(() => {})
    }
  }

  console.log(`\n[requests] Done. ${queued} job(s) queued.`)
  if (queued > 0) console.log('[requests] Next: run `npm run apply` to fill them in on LinkedIn for your review.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
