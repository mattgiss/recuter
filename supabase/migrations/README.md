# Database migrations

The simplified recuter (paste a job link → tailored resume + cover letter) uses
**only the profile data**. Here's what each migration is for.

## Current app — required

| Migration               | What it does                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `003_profile.sql`       | Creates `profile`, `experience`, `education`, `certifications` and seeds an example profile. **This is the data the generator reads.** |
| `005_seo_keywords.sql`  | Adds the `profile.seo_keywords` column (ATS/SEO terms woven into every document). |

**Fresh project:** run `003` then `005`.
**Existing recuter project:** the profile tables already exist — run only `005`.

You can run these in the Supabase **SQL Editor** (paste + Run) or with
`supabase db push`.

## Legacy — not used by this app

These belong to the old job-board / auto-apply system that now lives under
`/archive`. They're kept for history and because dropping live tables is
destructive. Leaving them applied is harmless; the current app never touches
them.

| Migration                  | Old purpose                                                  |
| -------------------------- | ----------------------------------------------------------- |
| `001_initial_schema.sql`   | `jobs`, `applications`, `resumes`, `cover_letters`, etc.    |
| `002_board_and_rls.sql`    | Public `board` view + RLS lockdown for the job board.       |
| `004_apply_requests.sql`   | `apply_requests` table behind the board's "Apply" button.   |

If you're standing up a brand-new project and want a minimal schema, you can
skip `001`, `002`, and `004` entirely — `003` and `005` are self-contained.
