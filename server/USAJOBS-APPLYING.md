# Applying on USAJOBS.gov (review-first)

When you tap **Apply with recuter** on a USAJOBS role, recuter prepares the
whole application on USAJOBS.gov — signs you in, selects your tailored résumé
and cover letter, and walks the apply wizard — then **stops at the agency
hand-off** and pings you. You answer the questionnaire + eligibility
attestations and click submit.

## Why recuter stops before submitting

USAJOBS only handles résumé/document selection. The final steps happen on the
hiring **agency's** external system and include the occupational questionnaire
and **eligibility attestations** (U.S. citizenship, veterans' preference,
selective-service, etc.). Those are legally binding self-certifications signed
under penalty — they must be answered and submitted by you, not a bot. So
recuter does all the setup and hands you the open browser at the
"Continue to agency site" step.

It runs **on your own machine** (a normal residential IP), not in the cloud.

## One-time setup

```bash
cd server
npm install
npx playwright install chromium     # downloads the browser recuter drives
```

In `server/.env`:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
DISCORD_WEBHOOK_URL=...
USAJOBS_EMAIL=...        # optional — shown as a reminder at the login.gov step
```

Sign-in is through **login.gov**, which requires MFA. recuter can't (and
shouldn't) bypass that — it opens the sign-in flow and waits while you complete
it in the window. The session is saved in `server/.usajobs-profile/`
(gitignored), so you normally only sign in once.

## Daily use

```bash
npm run requests       # turn board "Apply" taps into tailored résumé + cover letter, queued
npm run apply:usajobs  # prep the queued USAJOBS ones, review-first
```

When you run `npm run apply:usajobs`:

1. A real Chrome window opens. If you're not signed in, complete login.gov
   (password + MFA) in that window — recuter waits, then continues.
2. For each queued USAJOBS job, recuter opens the posting, starts the
   application, uploads your tailored résumé + cover letter, advances the
   wizard, and **stops at "Continue to agency site."**
3. You get a Discord ping that applications are prepped.
4. In each open tab: click **Continue to agency site**, answer the
   questionnaire + attestations, and submit.
5. Press **Enter** in the terminal to close the browser when you're done.

## Notes / known limits

- recuter **never** auto-submits a federal application.
- USAJOBS has no "apply" API (the API is search-only), so this is browser
  automation. The selectors in `src/apply/usajobs.ts` are flagged where they
  need a verification pass against the live signed-in site — run it once with a
  real posting and adjust any that have drifted. The control flow is fail-safe:
  recuter only clicks résumé/document and "Next/Continue" controls and stops at
  the hand-off, so a missed selector leaves the tab for you rather than doing
  anything unintended.
- Jobs from other sources (e.g. LinkedIn) are handled by `npm run apply`.
