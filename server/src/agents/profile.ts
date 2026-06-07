/**
 * YOUR GIS PROFILE — edit this file with your real experience.
 * All agents (scorer, resume, cover letter) pull from here.
 */
export const USER_PROFILE = {
  name: 'Matt Gisssentanna',
  email: 'matt@gissentanna.com',
  location: 'Denver, CO',
  phone: '',             // add your phone number
  linkedin: '',          // add your LinkedIn URL
  github: 'github.com/mattgiss',

  targetRoles: [
    'GIS Analyst',
    'GIS Developer',
    'GIS Engineer',
    'Geospatial Analyst',
    'Geospatial Developer',
    'Spatial Data Analyst',
    'GIS Specialist',
  ],
  targetSalaryGrossMin: 110_000,
  targetLocations: ['Denver, CO', 'Colorado', 'Remote'],
  willingToRelocate: false,

  summary: `GIS professional with expertise in spatial analysis, geospatial data engineering, and web mapping. Proficient in the full ESRI ecosystem and open-source GIS tools. Experienced automating spatial workflows with Python and building data pipelines that connect GIS to modern software infrastructure. Looking for a role where deep geospatial expertise drives real-world decisions.`,

  skills: {
    esri: [
      'ArcGIS Pro',
      'ArcGIS Online',
      'ArcGIS Enterprise',
      'ArcGIS StoryMaps',
      'ArcGIS Dashboards',
      'ArcGIS Experience Builder',
      'ArcMap',
      'ModelBuilder',
    ],
    openSource: [
      'QGIS',
      'PostGIS',
      'GDAL/OGR',
      'Leaflet',
      'MapboxGL JS',
      'OpenLayers',
    ],
    programming: [
      'Python (arcpy, geopandas, shapely, fiona)',
      'SQL / Spatial SQL',
      'JavaScript / TypeScript',
      'Jupyter Notebooks',
    ],
    databases: ['PostgreSQL/PostGIS', 'File Geodatabase', 'Enterprise Geodatabase', 'SQLite/SpatiaLite'],
    webGIS: ['ArcGIS JavaScript API', 'REST APIs', 'Feature Services', 'WMS/WFS'],
    dataEngineering: ['ETL/ELT pipelines', 'FME', 'Data automation', 'Coordinate reference systems'],
    domains: [
      'Spatial Analysis',
      'Remote Sensing',
      'Cartography & Map Design',
      'Urban & Land Use Planning',
      'Environmental Analysis',
      'Transportation',
      'Utility & Infrastructure',
    ],
    tools: ['Git', 'Docker', 'VS Code', 'QGIS', 'FME'],
  },

  // ── UPDATE THIS with your actual job history ──────────────────
  experience: [
    {
      title: 'GIS Analyst',
      company: '[Your Current/Recent Employer]',
      location: 'Denver, CO',
      period: '20XX – Present',
      highlights: [
        'Designed and maintained spatial databases supporting [X] users across [domain]',
        'Built Python/arcpy automation workflows reducing manual processing time by ~40%',
        'Produced interactive dashboards and story maps for executive and public audiences',
        'Managed geodatabase schema, versioning, and data quality for enterprise GIS environment',
        'Integrated third-party data feeds (census, satellite, sensor) into enterprise GIS',
      ],
    },
    {
      title: 'GIS Technician / Junior Analyst',
      company: '[Previous Employer]',
      location: 'Denver, CO',
      period: '20XX – 20XX',
      highlights: [
        'Performed spatial analysis and produced maps in support of [planning/environmental/engineering] projects',
        'Collected and processed field data using GPS devices and mobile data collection apps',
        'Maintained data in File and Enterprise geodatabases; performed QA/QC',
        'Created cartographic outputs meeting agency branding and accessibility standards',
      ],
    },
  ],

  // ── UPDATE THIS with your real education ──────────────────────
  education: [
    {
      degree: "Bachelor's in Geography / GIS / Geospatial Science",
      institution: '[University Name]',
      location: '[City, State]',
      year: '[Graduation Year]',
    },
  ],

  certifications: [
    // e.g. 'ESRI ArcGIS Desktop Entry Certification',
    // e.g. 'GISP (Geographic Information Systems Professional)',
  ],

  preferredIndustries: [
    'Government / Public Sector',
    'Environmental Consulting',
    'Technology / Software',
    'Engineering',
    'Utilities / Infrastructure',
    'Transportation / Logistics',
    'Nonprofit / NGO',
  ],

  dealBreakers: [
    'Salary under $90k gross',
    'Required relocation outside Colorado or remote ineligibility',
    'No actual GIS/geospatial component (pure IT or admin role)',
  ],

  // ── How Recuter writes emails on your behalf ──────────────────
  // Tune this so recruiter replies sound like you. Recuter always leaves
  // drafts for your review — it never sends without your go-ahead.
  voice: {
    // How you sign off your emails.
    signoff: 'Best,\nMatt Gissentanna',
    // The vibe Recuter should match when replying.
    guidelines: `Warm, genuine, and professional — never stiff or corporate.
Concise: two or three short paragraphs at most. Plain language, contractions are fine.
Enthusiastic about GIS work without overselling. Specific over generic.
For interview invites: thank them, confirm enthusiasm, offer concrete availability.
For screening questions: answer directly and briefly, tie back to relevant experience.
For rejections: a short, gracious thank-you that keeps the door open.
Never make up facts, dates, or commitments — if something needs the user's input,
leave a clearly marked [bracketed note] for them to fill in.`,
    // A couple of availability windows Recuter can offer for interviews.
    availability: 'weekday mornings and early afternoons, Mountain Time',
  },
}
