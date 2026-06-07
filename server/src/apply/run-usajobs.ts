import 'dotenv/config'
import * as path from 'path'
import { UsaJobsApplier } from './usajobs'
import { renderResumePdf } from './resume-pdf'
import { getPreparedApplications, markApplicationPrepared } from '../db/helpers'
import { notifyReadyToApply } from '../notifications/discord'

const ARTIFACTS_DIR = path.resolve(__dirname, '../../.artifacts')

/**
 * Prepares USAJOBS applications, review-first: recuter signs in (you clear MFA),
 * selects your tailored résumé + cover letter, walks the USAJOBS wizard, and
 * stops at the agency hand-off. You answer the questionnaire / attestations and
 * submit. Federal applications are never auto-submitted.
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — USAJOBS apply (review-first)')
  console.log('  I prep everything on USAJOBS. You attest + submit.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const prepared = await getPreparedApplications('usajobs')
  if (prepared.length === 0) {
    console.log('[usajobs] Nothing queued for USAJOBS right now.')
    console.log('[usajobs] Tap "Apply" on a USAJOBS role on the board, then run `npm run requests`.')
    return
  }
  console.log(`[usajobs] ${prepared.length} application(s) ready to prep.\n`)

  const applier = new UsaJobsApplier()
  await applier.init()
  await applier.ensureLoggedIn(process.env.USAJOBS_EMAIL)

  const readyForReview: Array<{ jobTitle: string; company: string; jobUrl: string }> = []

  for (let i = 0; i < prepared.length; i++) {
    const app = prepared[i]
    console.log(`\n[usajobs] (${i + 1}/${prepared.length}) ${app.jobTitle} @ ${app.company}`)

    try {
      // Render the tailored résumé (and cover letter, if any) to PDFs for upload.
      const resumePdf = path.join(ARTIFACTS_DIR, `resume-${app.applicationId}.pdf`)
      process.stdout.write('  → building résumé PDF ... ')
      await renderResumePdf(app.resumeContent, resumePdf)
      console.log('done')

      let coverPdf: string | undefined
      if (app.coverLetterContent) {
        coverPdf = path.join(ARTIFACTS_DIR, `cover-letter-${app.applicationId}.pdf`)
        process.stdout.write('  → building cover letter PDF ... ')
        await renderResumePdf(app.coverLetterContent, coverPdf)
        console.log('done')
      }

      // Each prepped app gets its own tab so they sit side by side for review.
      if (i > 0) await applier.newTab()

      process.stdout.write('  → preparing on USAJOBS ... ')
      const result = await applier.prepareApplication(app.jobUrl, resumePdf, coverPdf)

      if (result.status === 'ready') {
        console.log('ready at the agency hand-off ✓')
        await markApplicationPrepared(app.applicationId, app.jobId, 'usajobs')
        readyForReview.push({ jobTitle: app.jobTitle, company: app.company, jobUrl: app.jobUrl })
      } else if (result.status === 'no_apply_button') {
        console.log('skipped (no Apply button — already applied or posting closed)')
      } else {
        console.log(`needs you (${result.reason})`)
        await markApplicationPrepared(app.applicationId, app.jobId, 'usajobs')
        readyForReview.push({ jobTitle: app.jobTitle, company: app.company, jobUrl: app.jobUrl })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`error — ${msg}`)
    }
  }

  if (readyForReview.length) {
    await notifyReadyToApply(readyForReview).catch(e => console.warn(`[discord] ${e.message}`))
    console.log(`\n[usajobs] ${readyForReview.length} application(s) prepped. Pinged you on Discord.`)
  } else {
    console.log('\n[usajobs] Nothing ended up ready for review this round.')
  }

  // Keep the browser open so you can finish + submit, then close on Enter.
  await applier.holdOpenUntilEnter()
  console.log('[usajobs] Done.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
