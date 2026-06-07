import { chromium, BrowserContext, Page } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const PROFILE_DIR = path.resolve(__dirname, '../../.linkedin-profile')
const ARTIFACTS_DIR = path.resolve(__dirname, '../../.artifacts')

/** Random human-ish pause. */
function human(minMs = 600, maxMs = 1800): Promise<void> {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs))
  return new Promise(r => setTimeout(r, ms))
}

/** Type text with small per-character delays, like a person. */
async function typeHuman(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector)
  for (const ch of text) {
    await page.keyboard.type(ch)
    await new Promise(r => setTimeout(r, 40 + Math.random() * 90))
  }
}

export type PrepareResult =
  | { status: 'ready'; screenshot: string }
  | { status: 'not_easy_apply'; screenshot: string }
  | { status: 'needs_attention'; reason: string; screenshot: string }

export class LinkedInApplier {
  private context!: BrowserContext
  private page!: Page

  /** Launch a visible, persistent browser so the session sticks between runs. */
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

  /** Log in only if the persistent session isn't already authenticated. */
  async ensureLoggedIn(email: string, password: string): Promise<void> {
    await this.page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' })
    await human()

    if (!this.page.url().includes('/login') && !this.page.url().includes('/authwall')) {
      // Already logged in from the saved session.
      console.log('[linkedin] Using saved session — already logged in.')
      return
    }

    console.log('[linkedin] Logging in...')
    await this.page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' })
    await human()
    await typeHuman(this.page, '#username', email)
    await human(400, 900)
    await typeHuman(this.page, '#password', password)
    await human(500, 1200)
    await this.page.click('button[type="submit"]')
    await this.page.waitForLoadState('domcontentloaded')
    await human(2000, 3500)

    const url = this.page.url()
    if (url.includes('/checkpoint') || url.includes('/challenge') || url.includes('verification')) {
      console.log(
        '\n[linkedin] ⚠️  LinkedIn wants a security check (2FA / captcha).\n' +
          '           Please complete it in the open browser window.\n' +
          '           I\'ll wait — once you reach your feed, I\'ll continue.\n'
      )
      // Wait (up to 5 min) for the human to clear the checkpoint.
      await this.page
        .waitForURL(u => u.toString().includes('/feed'), { timeout: 5 * 60 * 1000 })
        .catch(() => {})
    }
    console.log('[linkedin] Login complete.')
  }

  /**
   * Open a job, start Easy Apply, attach the resume, and step through the form —
   * but STOP before the final submit. Leaves the page open for human review.
   */
  async prepareEasyApply(jobUrl: string, resumePdfPath: string): Promise<PrepareResult> {
    const stamp = Date.now()
    const shot = path.join(ARTIFACTS_DIR, `apply-${stamp}.png`)

    await this.page.goto(jobUrl, { waitUntil: 'domcontentloaded' })
    await human(1500, 2800)

    // Find the Easy Apply button (not the external "Apply" that leaves LinkedIn).
    const easyApply = this.page.locator('button.jobs-apply-button:has-text("Easy Apply")').first()
    if ((await easyApply.count()) === 0) {
      await this.page.screenshot({ path: shot })
      return { status: 'not_easy_apply', screenshot: shot }
    }

    await easyApply.click()
    await human(1200, 2200)

    // Attach the tailored resume if an upload control is present on any step.
    try {
      const fileInput = this.page.locator('input[type="file"]').first()
      if ((await fileInput.count()) > 0) {
        await fileInput.setInputFiles(resumePdfPath)
        await human(1000, 2000)
      }
    } catch {
      /* upload not on this step — fine */
    }

    // Advance through "Next"/"Review" steps, but never click "Submit application".
    // Review-first: we stop the moment the only way forward is to submit.
    for (let step = 0; step < 6; step++) {
      const submit = this.page.locator('button:has-text("Submit application")').first()
      if ((await submit.count()) > 0) {
        // We're at the final screen — stop here for the human.
        await this.page.screenshot({ path: shot })
        return { status: 'ready', screenshot: shot }
      }

      const next = this.page
        .locator('button:has-text("Next"), button:has-text("Review")')
        .first()
      if ((await next.count()) === 0) {
        // No clear next step — could be a question that needs a human.
        await this.page.screenshot({ path: shot })
        return {
          status: 'needs_attention',
          reason: 'Form has a step I can\'t fill automatically (likely a screening question).',
          screenshot: shot,
        }
      }

      await next.click()
      await human(900, 1800)
    }

    await this.page.screenshot({ path: shot })
    return {
      status: 'needs_attention',
      reason: 'Form had more steps than expected — please take a look.',
      screenshot: shot,
    }
  }

  /** Keep the browser open so the user can review and submit, then close on Enter. */
  async holdOpenUntilEnter(): Promise<void> {
    console.log(
      '\n[linkedin] Your applications are filled in and waiting in the browser.\n' +
        '           Review each tab and click "Submit application" when you\'re happy.\n' +
        '           Press Enter here to close the browser when you\'re done.\n'
    )
    await new Promise<void>(resolve => {
      process.stdin.resume()
      process.stdin.once('data', () => resolve())
    })
    await this.context.close()
  }

  page_(): Page {
    return this.page
  }

  /** Open the job in a fresh tab (so multiple prepped apps stay side by side). */
  async newTab(): Promise<void> {
    this.page = await this.context.newPage()
  }
}
