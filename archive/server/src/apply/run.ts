import 'dotenv/config'
import * as path from 'path'
import { LinkedInApplier } from './linkedin'
import { renderResumePdf } from './resume-pdf'
import { getPreparedApplications, markApplicationPrepared } from '../db/helpers'

const ARTIFACTS_DIR = path.resolve(__dirname, '../../.artifacts')

async function main() {
  const email = process.env.LINKEDIN_EMAIL
  const password = process.env.LINKEDIN_PASSWORD
  if (!email || !password) {
    console.error('ERROR: set LINKEDIN_EMAIL and LINKEDIN_PASSWORD in .env')
    process.exit(1)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — LinkedIn apply (review-first)')
  console.log('  I fill everything in. You click Submit.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const prepared = await getPreparedApplications('linkedin')
  if (prepared.length === 0) {
    console.log('[apply] Nothing queued for LinkedIn right now.')
    console.log('[apply] Run `npm run scrape` then `npm run score` to build the queue.')
    return
  }
  console.log(`[apply] ${prepared.length} application(s) ready to prep.\n`)

  const applier = new LinkedInApplier()
  await applier.init()
  await applier.ensureLoggedIn(email, password)

  const readyForReview: Array<{ jobTitle: string; company: string; jobUrl: string }> = []

  for (let i = 0; i < prepared.length; i++) {
    const app = prepared[i]
    console.log(`\n[apply] (${i + 1}/${prepared.length}) ${app.jobTitle} @ ${app.company}`)

    try {
      // Render this job's tailored resume to a PDF for upload.
      const pdfPath = path.join(ARTIFACTS_DIR, `resume-${app.applicationId}.pdf`)
      process.stdout.write('  → building resume PDF ... ')
      await renderResumePdf(app.resumeContent, pdfPath)
      console.log('done')

      // Each prepped app gets its own tab so they sit side by side for review.
      if (i > 0) await applier.newTab()

      process.stdout.write('  → filling Easy Apply ... ')
      const result = await applier.prepareEasyApply(app.jobUrl, pdfPath)

      if (result.status === 'ready') {
        console.log('ready for your review ✓')
        await markApplicationPrepared(app.applicationId, app.jobId)
        readyForReview.push({ jobTitle: app.jobTitle, company: app.company, jobUrl: app.jobUrl })
      } else if (result.status === 'not_easy_apply') {
        console.log('skipped (no Easy Apply — needs the company site)')
      } else {
        console.log(`needs you (${result.reason})`)
        await markApplicationPrepared(app.applicationId, app.jobId)
        readyForReview.push({ jobTitle: app.jobTitle, company: app.company, jobUrl: app.jobUrl })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`error — ${msg}`)
    }
  }

  if (readyForReview.length) {
    console.log(`\n[apply] ${readyForReview.length} application(s) prepped and ready for review.`)
  } else {
    console.log('\n[apply] Nothing ended up ready for review this round.')
  }

  // Keep the browser open so you can review + submit, then close on Enter.
  await applier.holdOpenUntilEnter()
  console.log('[apply] Done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
