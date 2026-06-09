# recuter

**Paste a job link → get a tailored resume and cover letter, saved to your computer.**

recuter keeps one master profile — your skills, experience, education,
certifications, and SEO/ATS keywords — and uses it to tailor a fresh resume and
cover letter for any job, on demand. That's the whole product.

```
  job URL ─▶  recuter.com  ─▶  Supabase `generate` function  ─▶  resume + cover letter
                (browser)        (reads your profile,             (saved to a folder
                                  fetches the JD, calls Claude)     on your computer)
```

---

## How it works

1. **Your profile** lives in Supabase (private tables): `profile` (contact,
   summary, skills, voice, **`seo_keywords`**), `experience`, `education`,
   `certifications`. Edit it anytime in the Supabase Table Editor — the
   generator reads it live on every run.
2. **The web app** (`index.html` + `app/`) is a static page on recuter.com. You
   give it a job listing URL (or paste the description). It calls one backend
   function and previews the results.
3. **The backend** is a single Supabase Edge Function, `supabase/functions/generate`.
   It reads your profile, fetches + extracts the job description, and asks Claude
   for a tailored resume (markdown) and cover letter. Your Anthropic API key
   stays server-side.
4. **Saving** — three ways, your choice of formats (PDF, DOCX, Markdown):
   - **Download** → your Downloads folder. Works in every browser.
   - **Save to folder…** → pick any folder, written directly (Chrome/Edge, via
     the File System Access API).
   - **Send to local helper** → the tiny `local-helper/` server writes files to
     a folder you configure, auto-organized by company. Any browser.

---

## What you need to run in Supabase

Exactly three things — a bit of SQL, one Edge Function, and one secret.

### 1. SQL: profile tables + SEO keywords

The app reads four tables: `profile`, `experience`, `education`,
`certifications`. They're created (and seeded with an example) by
`003_profile.sql`, and `005_seo_keywords.sql` adds the `seo_keywords` column.

- **Fresh project:** run `003_profile.sql` then `005_seo_keywords.sql`.
- **Existing recuter project (these tables already exist):** you only need to
  run the new `005_seo_keywords.sql`.

Either paste the SQL into the Supabase **SQL Editor** (Dashboard → SQL Editor →
New query → paste → Run), or use the CLI:

```bash
supabase db push        # applies everything in supabase/migrations/
```

> The other migrations — `001_initial_schema.sql`, `002_board_and_rls.sql`,
> `004_apply_requests.sql` — belong to the **old** job-board system and are not
> used by this app. Leaving them applied is harmless; see
> `supabase/migrations/README.md`.

### 2. Edge Function: `generate`

This is the entire backend. Deploy it from `supabase/functions/generate/`.

- **CLI:** `supabase functions deploy generate --no-verify-jwt`
- **Dashboard:** Edge Functions → Deploy a new function → name it `generate` →
  paste the contents of `supabase/functions/generate/index.ts`. Turn **"Verify
  JWT" off** (the function does its own auth check — see step 4 — and this keeps
  the CORS preflight working).

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected
into the function automatically — you don't set those.

### 3. Secrets: Anthropic key + allowed email

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... ALLOWED_EMAIL=you@example.com
```

(Or Dashboard → Edge Functions → Secrets.) `ANTHROPIC_API_KEY` lets the function
call Claude. `ALLOWED_EMAIL` restricts the function to a single account — even if
someone else signs up, only this email may generate.

### 4. Auth: create your login

The function rejects anyone who isn't signed in, so create your user:

1. **Authentication → Users → Add user** → your email + a password
   (set "Auto Confirm" so you can sign in immediately).
2. **Authentication → Providers → Email** → make sure it's enabled.
3. **Authentication → Sign-ups** → **turn off "Allow new users to sign up"** so
   no one else can create an account.

That's everything on the Supabase side. **No `npm`, no server to host, no cron.**

---

## Frontend setup

The site has two pages:

- **`/` (`index.html`)** — a public **coming-soon** page.
- **`/mattgiss/` (`mattgiss/index.html`)** — the actual app, behind a **Supabase
  email/password login**. It shares `/app/`, `/config.js`, and `/portfolio/`
  with the root via absolute paths.

> **How the lock works.** Sign-in uses Supabase Auth; the browser sends your
> logged-in token to the `generate` function, which validates it and checks it
> matches `ALLOWED_EMAIL` before doing any (paid) work. The public anon key in
> `config.js` is no longer enough to call the function — a real session is
> required. Sign-ups are disabled, so only the user you created in step 4 can
> get in.

### Point the site at your project

`config.js` holds your project URL and **anon** key (public-safe — the function
does the privileged work):

```js
window.RECUTER_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key"
};
```

Deploy the repo root as a static site (GitHub Pages or Vercel — `vercel.json` is
included). The custom domain is set via `CNAME` (recuter.com).

### Local helper (optional)

For "save to any folder in any browser":

```bash
cd local-helper
RECUTER_OUT="$HOME/Documents/Job Applications" node server.js
```

Leave it running while you use the site, then click **Send to local helper**.
Defaults to `~/recuter-applications` if `RECUTER_OUT` is unset. Override the port
with `RECUTER_PORT` and add allowed origins with `RECUTER_ALLOW`.

---

## Editing your profile

Everything the generator uses is data, not code:

| Table            | What to edit                                                        |
| ---------------- | ------------------------------------------------------------------- |
| `profile`        | name/contact, `summary`, `skills` (JSON by category), `seo_keywords`, `voice` |
| `experience`     | roles, `period`, `highlights[]` (newest first by `sort_order`)      |
| `education`      | degrees / certificates                                              |
| `certifications` | licenses & certs                                                    |

No redeploy needed — changes take effect on the next generation.

---

## Repo layout

```
index.html                      public coming-soon page
mattgiss/index.html             the app, behind a Supabase login
app/                            front-end (styles.css, app.js)
config.js                       Supabase URL + anon key
supabase/functions/generate/    the backend (one Edge Function)
supabase/migrations/            database schema + seed
local-helper/                   optional any-folder file writer
portfolio/                      personal portfolio page (linked in cover letters)
archive/                        previous version (scrapers, auto-apply, board, email)
```

The earlier, far larger version of recuter — job scrapers, Claude scoring,
LinkedIn auto-apply, an email inbox drafter, and a public job board — is
preserved under `archive/` and in git history.
