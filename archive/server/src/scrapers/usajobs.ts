import axios from 'axios'
import type { ScrapedJob } from './types'

interface USAJobsItem {
  MatchedObjectId: string
  MatchedObjectDescriptor: {
    PositionTitle: string
    PositionURI: string
    OrganizationName: string
    PositionLocation: Array<{ LocationName: string; CityName: string }>
    PositionRemuneration: Array<{
      MinimumRange: string
      MaximumRange: string
      RateIntervalCode: string
    }>
    PublicationStartDate: string
    UserArea?: {
      Details?: {
        JobSummary?: string
        Telework?: string
        RemoteIndicator?: boolean
      }
    }
  }
}

function parseRemoteType(item: USAJobsItem): ScrapedJob['remoteType'] {
  const details = item.MatchedObjectDescriptor.UserArea?.Details
  if (details?.RemoteIndicator === true) return 'remote'
  const telework = details?.Telework?.toLowerCase() ?? ''
  if (telework.includes('not eligible')) return 'onsite'
  if (telework.includes('eligible')) return 'hybrid'
  return 'unknown'
}

export async function scrapeUSAJobs(
  keywords: string[],
  salaryMin: number
): Promise<ScrapedJob[]> {
  const apiKey = process.env.USAJOBS_API_KEY
  const userAgent = process.env.USAJOBS_USER_AGENT

  if (!apiKey || !userAgent) {
    console.warn('[usajobs] Skipping — USAJOBS_API_KEY or USAJOBS_USER_AGENT not set')
    return []
  }

  const jobs: ScrapedJob[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    for (const locationName of ['Denver, Colorado', 'Colorado', 'Remote']) {
      try {
        const { data } = await axios.get('https://data.usajobs.gov/api/search', {
          headers: {
            Host: 'data.usajobs.gov',
            'User-Agent': userAgent,
            'Authorization-Key': apiKey,
          },
          params: {
            Keyword: keyword,
            LocationName: locationName === 'Remote' ? undefined : locationName,
            RemoteIndicator: locationName === 'Remote' ? true : undefined,
            SalaryMin: salaryMin,
            ResultsPerPage: 50,
            DatePosted: 30,
            SortField: 'OpenDate',
            SortDirection: 'Desc',
          },
        })

        const items: USAJobsItem[] =
          data?.SearchResult?.SearchResultItems ?? []

        for (const item of items) {
          const d = item.MatchedObjectDescriptor
          const url = d.PositionURI
          if (seen.has(url)) continue
          seen.add(url)

          const rem = d.PositionRemuneration?.[0]
          const salaryRaw =
            rem ? `$${rem.MinimumRange} – $${rem.MaximumRange} ${rem.RateIntervalCode}` : undefined
          const salaryMin_ = rem ? parseInt(rem.MinimumRange) : undefined
          const salaryMax_ = rem ? parseInt(rem.MaximumRange) : undefined

          jobs.push({
            title: d.PositionTitle,
            company: d.OrganizationName,
            url,
            description: d.UserArea?.Details?.JobSummary,
            location: d.PositionLocation?.[0]?.LocationName,
            remoteType: parseRemoteType(item),
            salaryMin: isNaN(salaryMin_ ?? NaN) ? undefined : salaryMin_,
            salaryMax: isNaN(salaryMax_ ?? NaN) ? undefined : salaryMax_,
            salaryRaw,
            postedAt: d.PublicationStartDate
              ? new Date(d.PublicationStartDate).toISOString()
              : undefined,
            source: 'usajobs',
            rawData: item as unknown as Record<string, unknown>,
          })
        }

        // polite delay between requests
        await sleep(800)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[usajobs] Error for "${keyword}" in ${locationName}: ${msg}`)
      }
    }
  }

  return jobs
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
