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
with where it stands in the pipeline. The board reads live from a Supabase **`board`
view** using the public anon key (read-only).

The actual data lives in the **agent backend** (the `jobs`, `employers`,
`applications`, `scraped_jobs`, … tables — already in the Supabase project, not
created by this repo). The website never touches those tables directly; it only
reads the curated `board` view, which exposes a safe subset of columns and joins
each job to its employer (company name) and most recent application (pipeline
status). The agent that *fills* those tables is a separate workstream — see
`voice-memo-2026-06-03.md`.

```
recuter/
  index.html              ← the job board (reads the `board` view)
  landing.html            ← the original coming-soon landing + waitlist (kept for reference)
  config.js               ← Supabase URL + anon key (filled in locally + on Vercel)
  config.example.js       ← template showing the shape of config.js
  supabase-schema.sql     ← waitlist table (legacy) + the public `board` view
  vercel.json             ← security headers, clean URLs
  voice-memo-2026-06-03.md
  README.md
```

### The board's statuses

The display status comes from the backend: a job's most recent `applications.status`
if it's been applied to, otherwise the `jobs.status`. The page gives these known
values a label, color, and ordering, and **falls back gracefully** for any other
string (so new backend statuses still render):

| status         | how it shows up                       |
|----------------|---------------------------------------|
| `new`          | green, sorts to the top, "Apply"      |
| `recommended`  | cyan, near the top, "Apply"           |
| `offer`        | gold                                  |
| `interviewing` | purple                                |
| `applied`      | blue                                  |
| `closed`       | dimmed                                |
| `rejected`     | dimmed                                |
| `passed`       | dimmed                                |

Today every job in the backend is `status = 'new'` (and `applications` is empty),
so the board is effectively your "to apply" pile. As the agent starts creating
`applications` rows, those statuses (`applied`, `interviewing`, …) flow through
automatically via the view's `coalesce(application.status, job.status)`.

> The mapping is in `STATUS` at the top of the `index.html` module script — adjust
> labels/colors there once the backend's real status vocabulary is confirmed.

By default the board shows **open roles** (everything except closed/rejected/passed);
use the status chips at the top to filter, or "Everything" to see them all.

## Setup — one-time

1. **Supabase project** already exists (it holds the agent backend). Grab its keys from Supabase → **Settings → API**: the **Project URL** and the **anon public** key.
2. **Create the `board` view.** In Supabase → SQL Editor → New query, paste the `board` view block from `supabase-schema.sql` and run it. This grants the anon key read access to the view only.
3. **Verify RLS** on the base tables (see the check at the bottom of `supabase-schema.sql`) so the anon key can't read them directly — only through the view.
4. **Fill in `config.js`** with the URL + anon key (the anon key is public-safe; service-role keys never go here).
5. **Push to GitHub** (see Git workflow below).
6. **Deploy.** Two options:
   - **GitHub Pages (current/interim host)** — see the section below. No extra account needed.
   - **Vercel** — import the repo, framework = "Other", no build command (static). Gives clean URLs + the security headers in `vercel.json`.
7. **Custom domain.** Point `recuter.com` at whichever host (DNS records from the host → add at GoDaddy).

### Deploy via GitHub Pages

The site is plain static files at the repo root, so Pages can serve it directly
(`.nojekyll` is committed so GitHub serves files as-is).

1. Merge the work to **`main`** (or pick the branch you want to publish).
2. GitHub repo → **Settings → Pages**.
3. **Source:** "Deploy from a branch" → **Branch:** `main`, **Folder:** `/ (root)` → **Save**.
4. Wait ~1 min, then open **`https://mattgiss.github.io/recuter/`**. The board loads
   live from Supabase (relative paths work fine under the `/recuter/` subpath).
5. **Custom domain (later):** add a `CNAME` file containing `recuter.com` (or set it
   under Settings → Pages → Custom domain), then point GoDaddy DNS at GitHub Pages.

> Want a preview *before* merging? In step 3 choose the feature branch instead of
> `main`; switch it back to `main` once merged.

### What appears on the board

Whatever the agent backend writes to `jobs` (joined to `employers`/`applications`)
flows straight onto the board through the view. You can also curate by hand in
Supabase → **Table Editor → `jobs`** (set `status`, `score`, `url`, …). Filtering
rules for which jobs are "still possible" enough to show are TBD — when decided,
add a `where` clause to the `board` view.

## Git workflow

`main` is the published branch (whichever host points at it). Until traffic shows up, working directly on `main` is fine. Once it's live, switch to feat-branch + PR (same gate we use on the gissentanna site).

## Local preview

Open `index.html` in a browser — it's fully static. Until `config.js` has real values,
the board shows a friendly "isn't connected yet" message instead of listings. Once the
schema is run and the keys are in, the board fetches and renders the `jobs` table live.
