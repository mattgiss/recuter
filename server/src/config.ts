export const SEARCH = {
  keywords: [
    'GIS Analyst',
    'GIS Technician',
    'GIS Specialist',
    'Geospatial Analyst',
    'Geospatial Data Technician',
    'Remote Sensing Technician',
    'Remote Sensing Analyst',
    'UAS Pilot',
    'Drone Pilot',
    'Photogrammetrist',
    'GIS Developer',
    'Geospatial Engineer',
  ],
  locations: ['Denver, CO', 'Colorado'],
  includeRemote: true,
  // Career-changer floor — entry/mid GIS+UAS roles. Raise once established.
  salaryMinGross: 75_000,
}

// How old a posting can be (days) before we skip it
export const MAX_POSTING_AGE_DAYS = 21

// Minimum job score to auto-queue for application
export const AUTO_APPLY_SCORE_THRESHOLD = 7
