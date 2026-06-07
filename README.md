# recuter

An AI agent that wins the race to "Apply" on perfect-fit job postings — built like a sneaker bot, aimed at the GIS job market.

**Live:** [recuter.com](https://recuter.com) (the job board)
**Stack:** static HTML + Supabase (`jobs` table) + Vercel (host) + GitHub (source)

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

A **public job board** — a rolling shortlist of the best-fit GIS jobs, each tagged
with where it stands in the pipeline (recommended → applied → interviewing → offer,
plus closed/rejected/passed). Listings stay on the board while they're still open
(`is_active = true`); the rules for when one drops off are TBD. The board reads live
from a Supabase `jobs` table using the public anon key (read-only via RLS).

The agent that *fills* the board lives in a separate workstream — see
`voice-memo-2026-06-03.md`.

```
recuter/
  index.html              ← the job board (reads the `jobs` table)
  landing.html            ← the original coming-soon landing + waitlist (kept for reference)
  config.js               ← Supabase URL + anon key (filled in locally + on Vercel)
  config.example.js       ← template showing the shape of config.js
  supabase-schema.sql     ← run this in the Supabase SQL editor (waitlist + jobs)
  seed-jobs.sql           ← optional sample jobs so the board isn't empty (delete later)
  vercel.json             ← security headers, clean URLs
  voice-memo-2026-06-03.md
  README.md
```

### The board's statuses

The page understands these `status` values (set them on each row in the `jobs` table):

| status         | what it means                          | how it shows up                |
|----------------|----------------------------------------|--------------------------------|
| `recommended`  | clears your bar — apply now            | green, sorts to the top, "Apply" |
| `offer`        | offer on the table — decide            | gold                           |
| `interviewing` | in the process — prep                  | purple                         |
| `applied`      | submitted — awaiting response          | blue                           |
| `closed`       | posting closed / window passed         | dimmed                         |
| `rejected`     | not moving forward                     | dimmed                         |
| `passed`       | you chose to skip                      | dimmed                         |

By default the board shows **open roles** (everything except closed/rejected/passed);
use the status chips at the top to filter, or "Everything" to see them all.

## Setup — one-time

1. **Create the Supabase project** at [supabase.com](https://supabase.com/dashboard) (free tier is fine). Name it `recuter`.
2. **Run the schema.** In Supabase → SQL Editor → New query, paste `supabase-schema.sql` and run it. Creates `waitlist` + `jobs`, with an RLS policy that lets the anon key **read active jobs** (but not write them).
3. **(Optional) Seed the board.** Run `seed-jobs.sql` to drop in a few sample listings so you can see it working. Remove them later with `delete from public.jobs where source = 'sample';`.
4. **Get the keys.** Supabase → Settings → API. Copy the **Project URL** and the **anon public** key.
5. **Fill in `config.js` locally** (do not commit secrets — the anon key is public-safe, but service-role keys never go in here).
6. **Push to GitHub** (see Git workflow below).
7. **Deploy on Vercel.** Import the GitHub repo, framework = "Other", no build command needed (static).
8. **Custom domain.** In Vercel → Project → Settings → Domains, add `recuter.com`. Vercel will give you DNS records to add at GoDaddy (A record + CNAME for `www`). Propagation is usually minutes.

### Adding / updating jobs

Jobs are written with the **service-role** side of Supabase, never the public anon key.
Quickest path for now: Supabase → **Table Editor → `jobs`** → insert/edit rows by hand
(set `status`, `match_score`, `url`, etc.). To pull one off the board, set `is_active = false`.
Later, the agent backend writes here directly.

## Git workflow

`main` is what Vercel deploys. Until traffic shows up, working directly on `main` is fine. Once it's live and getting signups, switch to feat-branch + PR (same gate we use on the gissentanna site).

## Local preview

Open `index.html` in a browser — it's fully static. Until `config.js` has real values,
the board shows a friendly "isn't connected yet" message instead of listings. Once the
schema is run and the keys are in, the board fetches and renders the `jobs` table live.
