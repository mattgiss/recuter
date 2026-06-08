# Applying on LinkedIn (review-first)

Recuter fills in each LinkedIn **Easy Apply** form and attaches your tailored
resume, then **stops before the final submit** and lists what's ready in the
terminal. You do the last click. This keeps a human on the submit button — the
safest way to automate without risking your account.

It runs **on your own machine** (a normal residential IP), not in the cloud.

## One-time setup

```bash
cd server
npm install
npx playwright install chromium     # downloads the browser Recuter drives
```

Make sure your `server/.env` has:

```
LINKEDIN_EMAIL=...
LINKEDIN_PASSWORD=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
```

(`.env` is gitignored — your password never gets committed.)

## Daily use

```bash
npm run scrape    # find new GIS jobs
npm run score     # score them + draft a resume & cover letter for the best
npm run apply     # fill in LinkedIn Easy Apply for the queued ones
```

When you run `npm run apply`:

1. A real Chrome window opens. The first time, Recuter logs you in. If LinkedIn
   asks for a 2FA code or captcha, just complete it in that window — Recuter
   waits, and the session is saved so you won't have to log in again next time.
2. For each queued job, Recuter opens Easy Apply, uploads the tailored resume,
   and clicks through to the final review screen — then stops.
3. The terminal lists the prepped applications — _"N ready, just need your ok
   to hit submit."_
4. Review each open tab and click **Submit application** on the ones you want.
5. Press **Enter** in the terminal to close the browser when you're done.

## Notes

- Recuter never auto-submits. If a job has a screening question it can't answer,
  it leaves that tab for you with a note.
- Jobs without Easy Apply (that bounce to the company's own site) are skipped —
  those are left for you to do by hand.
- The saved login lives in `server/.linkedin-profile/` (gitignored). Delete that
  folder to fully log out.
