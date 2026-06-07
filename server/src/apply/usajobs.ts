import { chromium, BrowserContext, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const PROFILE_DIR = path.resolve(__dirname, '../../.usajobs-profile')
const ARTIFACTS_DIR = path.resolve(__dirname, '../../.artifacts')

/** Random human-ish pause. */
function human(minMs = 600, maxMs = 1800): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs))
  return new Promise(r => setTimeout(r, ms))
}

export type PrepareResult =
  | { status: 'ready'; screenshot: string }
  | { status: 'no_apply_button'; screenshot: string }
  | { status: 'needs_attention'; reason: string; screenshot: string }

/**
 * Drives a USAJOBS application *up to the agency hand-off*, then stops.
 *
 * Why it stops there (by design — this is a feature, not a limitation):
 *   USAJOBS itself only handles résumé/document selection. The final steps —
 *   the occupational questionnaire and the eligibility attestations
 *   (citizenship, veterans' preference, etc.) — happen on the hiring agency's
 *   external system and are legally binding self-certifications. Those must be
 *   answered and submitted by the applicant. So recuter prepares everything on
 *   USAJOBS.gov and hands you the open browser at the "Continue to agency site"
 *   step for your review and submit.
 *
 * NOTE ON SELECTORS: USAJOBS markup can't be exercised from this repo's CI
 * (login.gov MFA + a real session are required), so the selectors below are
 * best-effort and flagged where they need a live verification pass on your
 * machine. The control flow is fail-safe regardless: recuter only ever clicks
 * controls labelled as résumé/document selection and "Next"/"Continue", and
 * STOPS the moment it reaches the agency hand-off — it never submits.
 */
export class UsaJobsApplier {
  private context!: BrowserContext
  private page!: Page

  /** Launch a visible, persistent browser so the login.gov session sticks. */
  async init(): Promise<void> {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true })
    this.context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: false,
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/Denver',
      args: ['--disable-blink-features=AutomationControlled'],
    })
    this.page = this.context.pages()[0] ?? (await this.context.newPage())
  }

  /**
   * Make sure we're signed in to USAJOBS. Sign-in goes through login.gov, which
   * requires MFA, so this is human-in-the-loop: recuter opens the sign-in flow
   * and waits (up to 5 min) for you to finish it in the window. The persistent
   * profile means you usually only do this once.
   */
  async ensureLoggedIn(emailHint?: string): Promise<void> {
    await this.page.goto('https://www.usajobs.gov/', { waitUntil: 'domcontentloaded' })
    await human()

    if (await this.isSignedIn()) {
      console.log('[usajobs] Using saved session — already signed in.')
      return
    }

    console.log(
      '\n[usajobs] Please sign in through login.gov in the open browser window.\n' +
        (emailHint ? `           Your USAJOBS email: ${emailHint}\n` : '') +
        '           Complete your password + MFA there. I\'ll wait until you land\n' +
        '           back on USAJOBS signed in, then continue.\n'
    )

    // Kick off the sign-in flow, then hand control to the human.
    const signIn = this.page.locator('a:has-text("Sign In"), a[href*="login.gov"]').first()
    if ((await signIn.count()) > 0) {
      await signIn.click().catch(() => {})
    }

    // Wait for the human to complete login.gov and return to a signed-in state.
    const deadline = Date.now() + 5 * 60 * 1000
    while (Date.now() < deadline) {
      if (this.page.url().includes('usajobs.gov') && (await this.isSignedIn())) {
        console.log('[usajobs] Sign-in complete.')
        return
      }
      await human(1500, 2500)
    }
    throw new Error('Timed out waiting for USAJOBS sign-in (5 min).')
  }

  /** True when the USAJOBS account menu (signed-in chrome) is present. */
  private async isSignedIn(): Promise<boolean> {
    // The account/avatar menu only renders when authenticated.
    // SELECTOR — verify against the live signed-in header.
    const account = this.page.locator(
      'a[href*="/profile"], button[aria-label*="account" i], a:has-text("My Account")'
    )
    return (await account.count()) > 0
  }

  /**
   * Open a posting, start the application, attach the tailored résumé (+ cover
   * letter if present), advance the USAJOBS wizard, and STOP at the agency
   * hand-off. Leaves the tab open for review.
   */
  async prepareApplication(
    jobUrl: string,
    resumePdfPath: string,
    coverLetterPdfPath?: string
  ): Promise<PrepareResult> {
    const stamp = Date.now()
    const shot = path.join(ARTIFACTS_DIR, `usajobs-apply-${stamp}.png`)

    await this.page.goto(jobUrl, { waitUntil: 'domcontentloaded' })
    await human(1500, 2800)

    // The green "Apply" button on a posting. (When already applied or closed,
    // it won't be present.)
    // SELECTOR — verify against a live posting.
    const apply = this.page
      .locator('a:has-text("Apply"), button:has-text("Apply")')
      .filter({ hasNotText: 'Saved' })
      .first()
    if ((await apply.count()) === 0) {
      await this.page.screenshot({ path: shot })
      return { status: 'no_apply_button', screenshot: shot }
    }
    await apply.click()
    await human(1500, 2800)

    // USAJOBS opens its apply wizard (résumé → documents → review → hand-off).
    // We walk forward through clearly-labelled steps and stop at the hand-off.
    for (let step = 0; step < 8; step++) {
      // 1) Hand-off boundary: a button that leaves USAJOBS for the agency site.
      //    This is where we STOP — never click it. Leave it for the human.
      // SELECTOR — verify the exact label ("Continue to agency site" /
      // "Apply, continue to agency site").
      const handoff = this.page
        .locator(
          'button:has-text("continue to agency"), a:has-text("continue to agency"), ' +
            'button:has-text("Continue to the agency")'
        )
        .first()
      if ((await handoff.count()) > 0) {
        await this.page.screenshot({ path: shot })
        return { status: 'ready', screenshot: shot }
      }

      // 2) Attach the tailored résumé / cover letter if an upload control is on
      //    this step. USAJOBS also allows picking an existing profile document;
      //    uploading the tailored file keeps each application's docs job-specific.
      try {
        const fileInput = this.page.locator('input[type="file"]').first()
        if ((await fileInput.count()) > 0) {
          const files = [resumePdfPath, ...(coverLetterPdfPath ? [coverLetterPdfPath] : [])]
          await fileInput.setInputFiles(files)
          await human(1200, 2200)
        }
      } catch {
        /* no upload on this step — fine */
      }

      // 3) Advance. USAJOBS uses "Next"/"Save and continue"/"Continue".
      // SELECTOR — verify labels across the wizard steps.
      const next = this.page
        .locator(
          'button:has-text("Save and continue"), button:has-text("Next"), ' +
            'button:has-text("Continue"):not(:has-text("agency"))'
        )
        .first()
      if ((await next.count()) === 0) {
        await this.page.screenshot({ path: shot })
        return {
          status: 'needs_attention',
          reason: "A wizard step needs you (no clear Next — likely a document or eligibility choice).",
          screenshot: shot,
        }
      }
      await next.click()
      await human(1000, 2000)
    }

    await this.page.screenshot({ path: shot })
    return {
      status: 'needs_attention',
      reason: 'The wizard had more steps than expected — please take a look.',
      screenshot: shot,
    }
  }

  /** Keep the browser open so the user can finish + submit, then close on Enter. */
  async holdOpenUntilEnter(): Promise<void> {
    console.log(
      '\n[usajobs] Your applications are prepared and waiting in the browser.\n' +
        '           For each tab: review, click "Continue to agency site", answer the\n' +
        '           questionnaire + eligibility attestations, and submit.\n' +
        '           Press Enter here to close the browser when you\'re done.\n'
    )
    await new Promise<void>(resolve => {
      process.stdin.resume()
      process.stdin.once('data', () => resolve())
    })
    await this.context.close()
  }

  /** Open the next job in a fresh tab so prepared apps sit side by side. */
  async newTab(): Promise<void> {
    this.page = await this.context.newPage()
  }
}
