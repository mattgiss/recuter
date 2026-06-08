import 'dotenv/config'
import { initProfile } from '../agents/profile'
import { draftReply } from '../agents/reply-writer'
import {
  getThreadsNeedingReply,
  matchEmployerApplication,
  upsertContact,
  saveDraftReply,
} from '../db/helpers'
import { notifyDraftReply } from '../notifications/discord'

const RATE_LIMIT_MS = 2_000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in .env')
    process.exit(1)
  }

  await initProfile()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  recuter — inbox (drafting recruiter replies)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const threads = await getThreadsNeedingReply()
  if (threads.length === 0) {
    console.log('[inbox] No replies waiting. (Forward recruiter emails to your intake address.)')
    return
  }
  console.log(`[inbox] ${threads.length} reply(ies) to draft.\n`)

  for (const t of threads) {
    console.log(`  from ${t.fromEmail} — "${t.subject}"`)
    try {
      const drafted = await draftReply({
        fromAddress: t.fromEmail,
        subject: t.subject,
        body: t.body,
      })

      // Try to link the thread to an existing application + employer.
      const match = drafted.company ? await matchEmployerApplication(drafted.company) : null
      const contactId = await upsertContact({
        employerId: match?.employerId ?? null,
        applicationId: match?.applicationId ?? null,
        name: drafted.senderName,
        email: t.fromEmail,
      })

      const replySubject = t.subject.toLowerCase().startsWith('re:') ? t.subject : `Re: ${t.subject}`
      await saveDraftReply({
        threadId: t.threadId,
        subject: replySubject,
        body: drafted.draft,
        toEmail: t.fromEmail,
        applicationId: match?.applicationId ?? null,
        contactId,
      })

      await notifyDraftReply({
        company: drafted.company || '',
        jobTitle: match?.jobTitle ?? null,
        type: drafted.type,
        summary: drafted.summary,
        draft: drafted.draft,
      }).catch(e => console.warn(`    [discord] ${e.message}`))

      console.log(`    → ${drafted.type} · drafted & pinged you ✓`)
      await sleep(RATE_LIMIT_MS)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`    error — ${msg}`)
    }
  }

  console.log('\n[inbox] Done. Review the drafts in Discord, tweak, and send.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
