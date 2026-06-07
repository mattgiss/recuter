export const SEARCH = {
  keywords: [
    'GIS Analyst',
    'GIS Developer',
    'GIS Engineer',
    'Geospatial Analyst',
    'Geospatial Developer',
    'Spatial Data Analyst',
    'GIS Specialist',
    'ArcGIS Developer',
    'Geospatial Engineer',
  ],
  locations: ['Denver, CO', 'Colorado'],
  includeRemote: true,
  // Colorado take-home target: $85-90k net ≈ $110-115k gross
  salaryMinGross: 100_000,
}

// How old a posting can be (days) before we skip it
export const MAX_POSTING_AGE_DAYS = 21

// Minimum job score to auto-queue for application
export const AUTO_APPLY_SCORE_THRESHOLD = 7
