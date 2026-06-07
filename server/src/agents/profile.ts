/**
 * YOUR CAREER RECORD.
 *
 * The single source of truth is the Supabase `profile` / `experience` /
 * `education` / `certifications` tables (see supabase/migrations/003_profile.sql).
 * Edit those in the Supabase Table Editor and every agent picks the change up
 * on its next run — call `await initProfile()` at the start of an entry point
 * and it loads the live record into USER_PROFILE.
 *
 * The DEFAULT_PROFILE below is a built-in fallback (used if the DB can't be
 * reached or hasn't been seeded yet). Keep it roughly in sync with the seed.
 */

export interface ProfileExperience {
  title: string
  company: string
  location?: string
  period: string
  isCurrent?: boolean
  highlights: string[]
}

export interface ProfileEducation {
  degree: string
  institution: string
  location?: string
  year: string
  inProgress?: boolean
  details?: string
}

export interface ProfileVoice {
  signoff: string
  guidelines: string
  availability: string
}

export interface Profile {
  name: string
  email: string
  location: string
  phone: string
  linkedin: string
  github: string
  portfolioUrl: string
  summary: string
  targetRoles: string[]
  targetSalaryGrossMin: number
  targetLocations: string[]
  willingToRelocate: boolean
  preferredIndustries: string[]
  dealBreakers: string[]
  /** category -> skills, e.g. { geospatial: [...], uasOperations: [...] } */
  skills: Record<string, string[]>
  experience: ProfileExperience[]
  education: ProfileEducation[]
  certifications: string[]
  voice: ProfileVoice
}

export const DEFAULT_PROFILE: Profile = {
  name: 'Matthew Gissentanna',
  email: 'matt@gissentanna.com',
  location: 'Brighton, CO',
  phone: '720-965-5369',
  linkedin: '',
  github: 'github.com/mattgiss',
  portfolioUrl: 'https://mattgiss.github.io/recuter/portfolio/',

  summary:
    'Geospatial and UAS professional transitioning into GIS, backed by 18+ years leading technical programs at Amazon/AWS, Rubrik, and beyond. FAA Part 107 remote pilot with hands-on commercial drone mapping, photogrammetry, and aerial data processing, currently completing a Graduate Certificate in GIS & Unmanned Aircraft Systems at the University of Denver. Pairs real field and sensor operations with deep experience building data pipelines, quality-assurance systems, and cross-functional execution.',

  targetRoles: [
    'GIS Analyst',
    'GIS Technician',
    'Geospatial Analyst',
    'Geospatial Data Technician',
    'Remote Sensing Technician',
    'UAS / Drone Pilot',
    'Photogrammetry Technician',
    'GIS Specialist',
  ],
  targetSalaryGrossMin: 75_000,
  targetLocations: ['Denver, CO', 'Brighton, CO', 'Colorado', 'Remote'],
  willingToRelocate: false,
  preferredIndustries: [
    'Surveying & Mapping',
    'UAS / Drone Services',
    'Geospatial / GIS',
    'Environmental',
    'Government / Public Sector',
    'AEC / Engineering',
    'Utilities / Infrastructure',
    'Technology',
  ],
  dealBreakers: [
    'Fully on-site role outside the Denver/Colorado area',
    'Requires permanent relocation out of Colorado',
  ],

  skills: {
    geospatial: ['ArcGIS Pro', 'ArcGIS Online', 'GIS Data Analysis', 'Global Mapper', 'Cartography & Map Projections', 'Spatial Analysis'],
    remoteSensing: ['Aerial Mapping & Photogrammetry', 'Remote Sensing Data Processing', 'Sensor Calibration & Operation', 'GPS/GNSS Operations'],
    uasOperations: ['FAA Part 107', 'UAS Mission Planning', 'Multi-rotor Flight Operations', 'Field Data Collection & Logging', 'Equipment Maintenance & Troubleshooting', 'Flight Safety'],
    programManagement: ['Agile & Scrum', 'Waterfall Delivery', 'Stakeholder Management', 'KPIs/SLAs & Metrics', 'Process Mapping', 'Risk Management', 'Budget Oversight', 'Cross-functional Leadership'],
    technical: ['Python (in progress)', 'SQL / MySQL', 'JSON/YAML/XML', 'Git & GitHub', 'AWS', 'Data Pipelines & Automation', 'Data QA/QC'],
    tools: ['ArcGIS Pro', 'Global Mapper', 'Jira', 'Confluence', 'Adobe Creative Suite', 'VS Code'],
  },

  experience: [
    {
      title: 'Owner / UAS Pilot & Aerial Mapping Operator',
      company: 'Liquid Sun Creative',
      location: 'Brighton, CO',
      period: '2024 – Present',
      isCurrent: true,
      highlights: [
        'Plan and execute commercial drone mapping missions — pre-flight planning, sensor configuration, and flight operations for aerial data acquisition.',
        'Process and quality-check aerial imagery and geospatial data, ensuring accuracy standards before client delivery.',
        'Maintain and troubleshoot UAS equipment: multi-rotor platforms, cameras, GPS receivers, and ground control stations.',
        'Complete detailed field logs, mission reports, and data documentation for each operation.',
        'Coordinate with clients and subcontractors on scheduling, site readiness, and safety protocols.',
      ],
    },
    {
      title: 'Senior Technical Program Manager',
      company: 'Amazon (AWS & Devices)',
      location: 'Denver, CO',
      period: 'Jul 2022 – Jan 2026',
      highlights: [
        'Built and managed automated data-processing pipelines, reducing manual handling and improving reporting accuracy across 200+ data points.',
        'Led an org-level vulnerability-management program for 154 engineers, defining KPIs/SLAs and tracking CVE discovery, remediation, and distribution while remaining FedRAMP compliant.',
        'Led cross-functional programs with 400+ stakeholders, coordinating field-level execution to 95% on-time completion.',
        'Designed tracking and QA systems that improved remediation efficiency by 50% and cut backlog by 80%.',
        'Briefed Directors and VPs through weekly and monthly business reviews and operations reviews.',
      ],
    },
    {
      title: 'Project Manager – Professional Services',
      company: 'Rubrik',
      location: 'Palo Alto, CA (Remote)',
      period: 'May 2021 – Jul 2022',
      highlights: [
        'Managed two of the largest deployment projects in company history ($10M+ budgets, 200+ team members).',
        'Optimized task assignment and resource allocation, increasing efficiency 35% and on-time delivery 20%.',
        'Maintained quality control across the project lifecycle to hold technical standards and schedule.',
      ],
    },
    {
      title: 'IT Supervisor – Application Development & Delivery',
      company: 'Synovus Financial',
      location: 'Columbus, GA',
      period: 'Jun 2018 – May 2021',
      highlights: [
        'Led a cross-functional scrum team modernizing digital and mobile banking applications (security, accessibility, performance).',
        'Managed 2 business analysts and 3 application engineers; served as Jira administrator and Center-of-Excellence lead.',
        'Acted as the central liaison between engineers, subject-matter experts, and business owners across development and testing.',
      ],
    },
    {
      title: 'Scrum Master – Product Management',
      company: 'Omega Financial',
      location: 'Columbus, GA',
      period: 'Feb 2016 – Jun 2018',
      highlights: [
        'Led a product-development team and introduced JIRA, Confluence, and Scrum practices company-wide.',
        'Led a tiger team to build a flagship mobile iOS application using Scrum.',
        'Delivered 6 database-conversion projects supporting annual revenue goals.',
      ],
    },
    {
      title: 'Scrum Master – Product Management',
      company: 'Delta Data Software',
      location: 'Columbus, GA',
      period: 'Sep 2014 – Feb 2016',
      highlights: [
        'Presented project status to executive leadership; managed incidents, prioritized features, and planned releases.',
        'Coordinated sprint planning, testing, and development; reviewed wireframes for UI and UX alignment.',
      ],
    },
    {
      title: 'Business Systems Analyst II',
      company: 'Aflac',
      location: 'Columbus, GA',
      period: 'Dec 2007 – Sep 2014',
      highlights: [
        'Liaison between business units and IT; organized JAD sessions for requirements gathering.',
        'Coordinated system testing and production-elevation schedules across on- and off-shore staff.',
        'Supported a team of 8 engineers through agile analysis, requirements, testing, and QA.',
      ],
    },
  ],

  education: [
    {
      degree: 'Graduate Certificate, GIS & Unmanned Aircraft Systems',
      institution: 'University of Denver',
      location: 'Denver, CO',
      year: 'Sep 2025 – Mar 2027',
      inProgress: true,
      details: 'Coursework: Cartography & Map Design, GIS Fundamentals, Remote Sensing, UAS Operations.',
    },
    { degree: 'B.S., Business Administration (Global Business)', institution: 'Troy University', location: 'Troy, AL', year: '2010 – 2019' },
    { degree: 'A.S., Management & Supervisory Development', institution: 'Columbus Technical College', location: 'Columbus, GA', year: '2006 – 2009' },
    { degree: 'Business Analysis Executive Program', institution: 'University of Georgia', location: 'Athens, GA', year: '2013' },
  ],

  certifications: [
    'FAA Part 107 Remote Pilot Certificate — FAA (current)',
    'Project Management Professional (PMP) — Project Management Institute (2017)',
    'Certified ScrumMaster (CSM) — Scrum Alliance (2015)',
    'CompTIA Server+ — CompTIA (2014)',
  ],

  voice: {
    signoff: 'Best,\nMatt Gissentanna',
    guidelines: `Warm, genuine, and professional — never stiff or corporate.
Concise: two or three short paragraphs at most. Plain language, contractions are fine.
Enthusiastic about GIS and geospatial work without overselling. Specific over generic.
For interview invites: thank them, confirm enthusiasm, offer concrete availability.
For screening questions: answer directly and briefly, tie back to relevant experience.
For rejections: a short, gracious thank-you that keeps the door open.
Never make up facts, dates, or commitments — if something needs your input,
leave a clearly marked [bracketed note] for you to fill in.`,
    availability: 'weekday mornings and early afternoons, Mountain Time',
  },
}

/**
 * The live profile. Starts as the built-in default; `initProfile()` replaces
 * it with the database record. Agents import this binding and read it at call
 * time, so the swap is picked up automatically.
 */
export let USER_PROFILE: Profile = DEFAULT_PROFILE

let initialized = false

/** Load the career record from Supabase into USER_PROFILE. Safe to call more
 *  than once; falls back to DEFAULT_PROFILE if the DB is unreachable/empty. */
export async function initProfile(): Promise<void> {
  if (initialized) return
  initialized = true
  try {
    const { loadProfileFromDb } = await import('../db/profile')
    const loaded = await loadProfileFromDb()
    if (loaded) {
      USER_PROFILE = loaded
      console.log(`[profile] Loaded "${loaded.name}" from database — ${loaded.experience.length} roles, ${loaded.certifications.length} certs.`)
    } else {
      console.warn('[profile] No profile row found in database — using built-in default.')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[profile] Could not load profile from database (${msg}) — using built-in default.`)
  }
}
