# recuter

An AI agent that wins the race to "Apply" on perfect-fit job postings — built like a sneaker bot, aimed at the GIS job market.

**Live:** [recuter.com](https://recuter.com) (coming soon landing page)

**Notifications:** GitHub activity posts to Discord automatically.
**Stack (landing):** static HTML + Supabase (waitlist) + Vercel (host) + GitHub (source)

---

## The problem

Job alerts surface postings that match the user's profile almost perfectly, but the postings close before a thoughtful application can be submitted. LinkedIn's "150 applicants" cap is functionally a sneaker drop: the first few dozen submissions are seen, the rest are discarded. SEO-style profile optimization has succeeded at *finding* the right jobs — but created a new bottleneck at *applying* to them.

In short:
- **Discovery is solved.** Alerts arrive fast and on-target.
- **Application is the bottleneck.** Manual application can't compete with bot-assisted submissions and applicant caps.

## The idea

A personal application agent that monitors job alerts, decides which postings clear a relevance bar, and submits a tailored application within seconds of the posting going live — beating the cap, not the recruiter.

Two halves:

1. **Relevance + tailoring.** Score incoming postings against the user's profile; auto-tailor resume bullets and cover letter to the JD; flag anything that needs a human in the loop.
2. **Fast-path submission.** Headless browser automation against LinkedIn / Indeed / Greenhouse / Workday-style portals, with CAPTCHA handling — the "sneaker bot" half of the stack.

## Target market (initial)

- **Field:** GIS jobs (entry to mid).
- **Constraint:** Compatible with grad certificate finishing Nov 2026 → Master's starting Jan 2027.
- **Open paths within GIS:** environmental, hydraulic / civil infrastructure, remote sensing / drone-based capture.

---

## This repo (right now)

Just the **coming-soon landing page** + waitlist email capture. The agent itself lives in a separate workstream — see `voice-memo-2026-06-03.md`.

```
recuter/
  index.html              ← the landing page
  config.js               ← Supabase URL + anon key (filled in locally + on Vercel)
  config.example.js       ← template showing the shape of config.js
  supabase-schema.sql     ← run this in the Supabase SQL editor
  vercel.json             ← security headers, clean URLs
  voice-memo-2026-06-03.md
  README.md
```

## Setup — one-time

1. **Create the Supabase project** at [supabase.com](https://supabase.com/dashboard) (free tier is fine). Name it `recuter`.
2. **Run the schema.** In Supabase → SQL Editor → New query, paste `supabase-schema.sql` and run it. Creates `waitlist` + an RLS policy that only allows `INSERT` (the anon key can't read the list).
3. **Get the keys.** Supabase → Settings → API. Copy the **Project URL** and the **anon public** key.
4. **Fill in `config.js` locally** (do not commit secrets — the anon key is public-safe, but service-role keys never go in here).
5. **Push to GitHub** (see Git workflow below).
6. **Deploy on Vercel.** Import the GitHub repo, framework = "Other", no build command needed (static).
7. **Custom domain.** In Vercel → Project → Settings → Domains, add `recuter.com`. Vercel will give you DNS records to add at GoDaddy (A record + CNAME for `www`). Propagation is usually minutes.

## Git workflow

`main` is what Vercel deploys. Until traffic shows up, working directly on `main` is fine. Once it's live and getting signups, switch to feat-branch + PR (same gate we use on the gissentanna site).

## Local preview

Open `index.html` in a browser — it's fully static. Until `config.js` has real values, the form will show an error on submit, which is expected.
