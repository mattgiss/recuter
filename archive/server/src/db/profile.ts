import { db } from './client'
import type { Profile, ProfileExperience, ProfileEducation } from '../agents/profile'

/**
 * Load the master career record from Supabase (profile + experience +
 * education + certifications) and assemble it into the Profile shape the
 * agents expect. Returns null if there is no profile row yet.
 */
export async function loadProfileFromDb(): Promise<Profile | null> {
  const { data: p, error } = await db.from('profile').select('*').eq('id', 1).maybeSingle()
  if (error) throw new Error(`profile query failed: ${error.message}`)
  if (!p) return null

  const [{ data: expRows }, { data: eduRows }, { data: certRows }] = await Promise.all([
    db.from('experience').select('*').order('sort_order', { ascending: true }),
    db.from('education').select('*').order('sort_order', { ascending: true }),
    db.from('certifications').select('*').order('sort_order', { ascending: true }),
  ])

  const experience: ProfileExperience[] = (expRows ?? []).map(r => ({
    title: r.title,
    company: r.company,
    location: r.location ?? undefined,
    period: r.period ?? '',
    isCurrent: r.is_current ?? false,
    highlights: r.highlights ?? [],
  }))

  const education: ProfileEducation[] = (eduRows ?? []).map(r => ({
    degree: r.degree,
    institution: r.institution,
    location: r.location ?? undefined,
    year: r.period ?? '',
    inProgress: r.in_progress ?? false,
    details: r.details ?? undefined,
  }))

  const certifications: string[] = (certRows ?? []).map(r => {
    const issuer = r.issuer ? ` — ${r.issuer}` : ''
    const year = r.year ? ` (${r.year})` : r.current ? ' (current)' : ''
    return `${r.name}${issuer}${year}`
  })

  return {
    name: p.name,
    email: p.email ?? '',
    location: p.location ?? '',
    phone: p.phone ?? '',
    linkedin: p.linkedin ?? '',
    github: p.github ?? '',
    portfolioUrl: p.portfolio_url ?? '',
    summary: p.summary ?? '',
    targetRoles: p.target_roles ?? [],
    targetSalaryGrossMin: p.target_salary_gross_min ?? 0,
    targetLocations: p.target_locations ?? [],
    willingToRelocate: p.willing_to_relocate ?? false,
    preferredIndustries: p.preferred_industries ?? [],
    dealBreakers: p.deal_breakers ?? [],
    skills: (p.skills ?? {}) as Record<string, string[]>,
    experience,
    education,
    certifications,
    voice: {
      signoff: p.voice?.signoff ?? '',
      guidelines: p.voice?.guidelines ?? '',
      availability: p.voice?.availability ?? '',
    },
  }
}
