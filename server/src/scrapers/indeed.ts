import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedJob } from './types'

// Indeed exposes an RSS feed — more stable than scraping HTML
const INDEED_RSS = 'https://www.indeed.com/rss'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  'Accept-Language': 'en-US,en;q=0.9',
}

function parseSalaryFromText(text: string): {
  min?: number
  max?: number
  raw?: string
} {
  const clean = text.replace(/,/g, '')
  // hourly: $55/hr - $70/hr
  const hourly = clean.match(/\$(\d+(?:\.\d+)?)\s*\/\s*hr?\s*[-–]\s*\$(\d+(?:\.\d+)?)/)
  if (hourly) {
    const min = Math.round(parseFloat(hourly[1]) * 2080)
    const max = Math.round(parseFloat(hourly[2]) * 2080)
    return { min, max, raw: text.trim() }
  }
  // annual: $110,000 - $140,000
  const annual = clean.match(/\$(\d{4,6})\s*[-–]\s*\$(\d{4,6})/)
  if (annual) {
    return {
      min: parseInt(annual[1]),
      max: parseInt(annual[2]),
      raw: text.trim(),
    }
  }
  // single value: $120,000
  const single = clean.match(/\$(\d{4,6})/)
  if (single) {
    const val = parseInt(single[1])
    return { min: val, max: val, raw: text.trim() }
  }
  // k-notation: $90K - $120K
  const kNote = clean.match(/\$(\d+)[kK]\s*[-–]\s*\$(\d+)[kK]/)
  if (kNote) {
    return {
      min: parseInt(kNote[1]) * 1000,
      max: parseInt(kNote[2]) * 1000,
      raw: text.trim(),
    }
  }
  return {}
}

function inferRemoteType(title: string, desc: string): ScrapedJob['remoteType'] {
  const combined = (title + ' ' + desc).toLowerCase()
  if (combined.includes('remote')) return 'remote'
  if (combined.includes('hybrid')) return 'hybrid'
  if (combined.includes('on-site') || combined.includes('onsite') || combined.includes('in office')) return 'onsite'
  return 'unknown'
}

export async function scrapeIndeed(
  keywords: string[],
  location: string,
  salaryMin: number
): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    const searchLocations = [location, 'remote']

    for (const loc of searchLocations) {
      try {
        const { data: xml } = await axios.get(INDEED_RSS, {
          headers: HEADERS,
          params: {
            q: keyword,
            l: loc,
            sort: 'date',
            fromage: 21,         // posted in last 21 days
            limit: 50,
          },
          timeout: 15_000,
        })

        const $ = cheerio.load(xml, { xmlMode: true })

        $('item').each((_, el) => {
          const title = $(el).find('title').text().trim()
          const link = $(el).find('link').text().trim() || $(el).find('guid').text().trim()
          const pubDate = $(el).find('pubDate').text().trim()
          const descHtml = $(el).find('description').text()

          if (!title || !link) return

          // Normalise URL — strip tracking params, use canonical form
          let url = link
          try {
            const u = new URL(link)
            const jk = u.searchParams.get('jk')
            url = jk
              ? `https://www.indeed.com/viewjob?jk=${jk}`
              : link.split('?')[0]
          } catch { /* keep original */ }

          if (seen.has(url)) return
          seen.add(url)

          // Extract company from title: "Job Title - Company - Location"
          const parts = title.split(' - ')
          const jobTitle = parts[0]?.trim() ?? title
          const company = parts[1]?.trim() ?? 'Unknown'

          // Strip HTML from description
          const descText = cheerio.load(descHtml).text().trim()

          // Parse salary from description
          const salaryMatch = descText.match(/\$[\d,]+(?:\.\d+)?\s*(?:\/\s*hr?)?\s*[-–]\s*\$[\d,]+(?:\.\d+)?(?:\s*\/\s*hr?)?|\$[\d,]+[kK]\s*[-–]\s*\$[\d,]+[kK]/i)
          const salaryData = salaryMatch
            ? parseSalaryFromText(salaryMatch[0])
            : {}

          // Skip if salary is clearly below target
          if (salaryData.max && salaryData.max < salaryMin * 0.8) return

          jobs.push({
            title: jobTitle,
            company,
            url,
            description: descText.slice(0, 2000),
            location: loc,
            remoteType: inferRemoteType(jobTitle, descText),
            salaryMin: salaryData.min,
            salaryMax: salaryData.max,
            salaryRaw: salaryData.raw,
            postedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
            source: 'indeed',
          })
        })

        await sleep(1200 + Math.random() * 800)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[indeed] Error for "${keyword}" in "${loc}": ${msg}`)
      }
    }
  }

  return jobs
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
