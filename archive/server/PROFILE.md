# Your career record

Your work history, education, certifications, skills, and profile are the
**single source of truth** for everything Recuter writes (job scoring, tailored
résumés, cover letters, and email replies). They live in Supabase so you can keep
them current without touching code.

## Where it lives

Four tables, created/seeded by `supabase/migrations/003_profile.sql`:

| Table | What's in it |
|-------|--------------|
| `profile` | One row: name, contact, summary, target roles, salary floor, skills (by category), and your email "voice" |
| `experience` | One row per job (newest first by `sort_order`), with a `highlights` array |
| `education` | Degrees / certificates / programs |
| `certifications` | Licenses & certs (FAA Part 107, PMP, …) |

These tables are **private** — RLS is on with no public policy, so the anon key
(and the public board) can never read them. The agents read them with the
service-role key.

## How to update it (continuous, no deploy needed)

1. Supabase dashboard → **Table Editor** → pick `experience` (or any table).
2. Add / edit / reorder rows. For a new job: **Insert row**, set `sort_order`
   (lower = higher on the résumé), fill `title`/`company`/`period`, and add
   `highlights` as a list.
3. That's it — the next `npm run score` / `npm run inbox` loads the change
   automatically via `initProfile()`.

To tweak skills, summary, target roles, salary floor, or your reply voice, edit
the single `profile` row (`skills` and `voice` are JSON).

## History

- **Schema history** is in git (the migrations).
- **Data history**: every change is captured by Supabase's Point-in-Time
  Recovery / logs. If you want a hard, diffable audit trail later, we can add a
  trigger that writes changes to a `profile_history` table.

## Fallback

If the database can't be reached, the agents fall back to `DEFAULT_PROFILE` in
`server/src/agents/profile.ts` (kept roughly in sync with the seed), so a run
never crashes for lack of a profile.
