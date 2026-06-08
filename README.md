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

## Setup

### 1. Database

Apply the migrations in `supabase/migrations/` (the profile tables are
`003_profile.sql`; SEO keywords are added in `005_seo_keywords.sql`). The
`003` migration seeds an example profile — edit it to be yours in the Table
Editor.

```bash
supabase db push        # or paste the SQL in the Supabase SQL editor
```

### 2. Backend function

```bash
supabase functions deploy generate --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.
`--no-verify-jwt` lets the public site call it with the anon key.

### 3. Frontend

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

### 4. Local helper (optional)

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
index.html                      the app
app/                            front-end (styles.css, app.js)
config.js                       Supabase URL + anon key
supabase/functions/generate/    the backend (one Edge Function)
supabase/migrations/            database schema + seed
local-helper/                   optional any-folder file writer
portfolio/                      personal portfolio page (linked in cover letters)
archive/                        previous version (scrapers, auto-apply, board, email)
```

The earlier, far larger version of recuter — job scrapers, Claude scoring,
LinkedIn auto-apply, an email inbox drafter, Discord alerts, and a public job
board — is preserved under `archive/` and in git history.
