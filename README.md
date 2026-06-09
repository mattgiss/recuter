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
  JWT" off** so the public site can call it with the anon key.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into the function
automatically — you don't set those.

### 3. Secret: your Anthropic API key

The function calls Claude, so it needs your key:

- **CLI:** `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
- **Dashboard:** Edge Functions → Secrets → add `ANTHROPIC_API_KEY`.

That's everything on the Supabase side. **No `npm`, no server to host, no cron.**

---

## Frontend setup

The site has two pages:

- **`/` (`index.html`)** — a public **coming-soon** page.
- **`/mattgiss/` (`mattgiss/index.html`)** — the actual app, behind a **PIN gate**.
  It shares `/app/`, `/config.js`, and `/portfolio/` with the root via absolute
  paths.

> **The PIN is a casual gate, not security.** It hides the UI from casual
> visitors, but the page code and the public anon key are still viewable by
> anyone who inspects the site. To change it, replace the `EXPECTED` SHA-256
> hash in `mattgiss/index.html` (hash your new PIN: `printf '%s' 'YOURPIN' |
> sha256sum`). For real protection, switch to Supabase Auth on the function.

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
mattgiss/index.html             the app, behind a PIN gate
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
