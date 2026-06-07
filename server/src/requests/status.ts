import 'dotenv/config'
import {
  getPendingStatusRequests,
  markStatusRequestDone,
  applyBoardStatus,
  getJobById,
} from '../db/helpers'

/**
 * Processes status-change requests from the board (the "Mark applied" switch
 * and friends). For each pending request, flips the real job/application status
 * with the service-role key, then marks the request done. No LLM needed — this
 * is pure bookkeeping, so it's its own fast command.
 */
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — status changes from the board')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const requests = await getPendingStatusRequests()
  if (requests.length === 0) {
    console.log('[status] Nothing to update from the board right now.')
    return
  }
  console.log(`[status] ${requests.length} status change(s) to apply.\n`)

  let done = 0
  for (const req of requests) {
    try {
      const job = await getJobById(req.jobId)
      const label = job ? `${job.title} @ ${job.company}` : req.jobId
      if (!job) {
        console.log(`  ✗ job ${req.jobId} not found — skipping`)
        await markStatusRequestDone(req.id, 'error', 'job not found')
        continue
      }

      await applyBoardStatus(req.jobId, req.toStatus)
      await markStatusRequestDone(req.id, 'done')
      console.log(`  • ${label} → ${req.toStatus} ✓`)
      done++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ ${req.jobId} — ${msg}`)
      await markStatusRequestDone(req.id, 'error', msg).catch(() => {})
    }
  }

  console.log(`\n[status] Done. ${done} change(s) applied.`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
