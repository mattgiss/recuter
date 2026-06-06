# Email intake — forward your job alerts to Recuter

Instead of scraping job boards (which get IP-blocked), forward the **job-alert
emails you already receive** (LinkedIn, Indeed, ZipRecruiter, Glassdoor, company
career sites) to one address. Recuter reads each email, pulls out the postings
with Claude, and drops them into the same pipeline — scoring, resume/cover-letter
drafting, and Discord all happen automatically.

```
LinkedIn/Indeed alert email
        │  (auto-forward rule)
        ▼
jobs@gissentanna.com  →  inbound handler  →  Claude extracts postings
                                                   │
                                                   ▼
                                          jobs table (status 'new')
                                                   │
                                       npm run score / daily workflow
                                                   ▼
                                       resume + cover letter + Discord
```

## The handler (one-time deploy)

The parser is a Supabase Edge Function at `supabase/functions/inbound-email`.

```bash
# from the repo root, with the Supabase CLI logged in + linked
supabase functions deploy inbound-email --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... INBOUND_EMAIL_TOKEN=<any-random-string>
```

Its URL will be:
`https://<project-ref>.supabase.co/functions/v1/inbound-email`

(`<project-ref>` is `jttvbcmfwbfrjxwgrmzq`.)

## Getting an address to forward to — pick one

### Option A — your own domain (recommended, free)
You own `gissentanna.com`, so use it.

1. Cloudflare → add `gissentanna.com` (if not already) → **Email → Email Routing** → enable.
2. Create address **`jobs@gissentanna.com`**, action **"Send to a Worker"**.
3. Create a Worker with the code in
   `supabase/functions/_cloudflare-email-worker/worker.js`, and set its vars:
   - `FUNCTION_URL` = the function URL above
   - `INBOUND_TOKEN` = the same value you used for `INBOUND_EMAIL_TOKEN`
4. Add the `postal-mime` package to the Worker.

Now anything sent to `jobs@gissentanna.com` flows into the pipeline.

### Option B — zero domain setup (instant address)
Use an inbound-parse service (e.g. Postmark inbound). It gives you an address
like `<hash>@inbound.postmarkapp.com` immediately. Point its inbound webhook at:
`https://<project-ref>.supabase.co/functions/v1/inbound-email?token=<INBOUND_EMAIL_TOKEN>`
Then forward your alerts to that address. The handler already understands
Postmark / SendGrid / Mailgun field names.

## The one-time forwarding rule

In Gmail (or wherever your alerts land):

1. Settings → **Forwarding** → add `jobs@gissentanna.com` (confirm it).
2. Settings → **Filters** → Create filter:
   - From: `jobs-noreply@linkedin.com OR alert@indeed.com OR noreply@ziprecruiter.com`
   - Action: **Forward to** `jobs@gissentanna.com`

That's it. New alert lands → Recuter parses it → you get a Discord ping for any
strong match, resume and cover letter already drafted.

## Recruiter replies → drafted responses

The same address handles **replies from recruiters and hiring managers**, not
just alerts. Forward (or auto-forward) those emails to the same intake address.
Recuter tells a personal reply from a job-alert digest automatically:

- **Job-alert digest** → postings extracted into the pipeline (above).
- **Personal reply** (interview invite, screening questions, scheduling, an
  offer, a rejection) → stored as an email thread that "needs a reply".

Then, on your machine:

```bash
npm run inbox
```

For each waiting reply, Recuter:

1. classifies it (interview request / screening questions / scheduling / offer /
   rejection / recruiter outreach),
2. links it to the matching application + employer where it can,
3. drafts a response **in your voice** (tuned in `src/agents/profile.ts` →
   `voice`), and
4. pings you on Discord with a quick read **and the full draft** — copy, tweak,
   send. Recuter never sends on its own.

Tune how these sound by editing the `voice` block in
`server/src/agents/profile.ts` (sign-off, tone, interview availability).

To forward replies in Gmail, add a filter for mail **to** your own address that
is a reply (e.g. `subject:re` from recruiting domains) → forward to the intake
address. Or just forward them by hand as they arrive.

## Test it

Forward any LinkedIn/Indeed job alert to your address. Within a minute the jobs
should appear in the `jobs` table (status `new`). Run `npm run score` (or wait
for the daily workflow) to score them and draft documents.

Then forward a recruiter-style email and run `npm run inbox` — you'll get a
drafted reply in Discord within a few seconds.
