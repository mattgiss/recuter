import axios from 'axios'
import * as cheerio from 'cheerio'
import type { ScrapedJob } from './types'

// LinkedIn guest jobs API — public, no login required
const LI_GUEST_API = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Referer': 'https://www.linkedin.com/jobs/search/',
}

// Denver, Colorado geoId on LinkedIn
const DENVER_GEO_ID = '101174742'

function parsePostedAt(relativeText: string): string | undefined {
  const t = relativeText.toLowerCase().trim()
  const now = new Date()

  const hourMatch = t.match(/(\d+)\s*hour/)
  if (hourMatch) {
    now.setHours(now.getHours() - parseInt(hourMatch[1]))
    return now.toISOString()
  }
  const dayMatch = t.match(/(\d+)\s*day/)
  if (dayMatch) {
    now.setDate(now.getDate() - parseInt(dayMatch[1]))
    return now.toISOString()
  }
  const weekMatch = t.match(/(\d+)\s*week/)
  if (weekMatch) {
    now.setDate(now.getDate() - parseInt(weekMatch[1]) * 7)
    return now.toISOString()
  }
  const monthMatch = t.match(/(\d+)\s*month/)
  if (monthMatch) {
    now.setMonth(now.getMonth() - parseInt(monthMatch[1]))
    return now.toISOString()
  }
  return undefined
}

function inferRemoteType(title: string, subtitle: string): ScrapedJob['remoteType'] {
  const combined = (title + ' ' + subtitle).toLowerCase()
  if (combined.includes('remote')) return 'remote'
  if (combined.includes('hybrid')) return 'hybrid'
  if (combined.includes('on-site') || combined.includes('onsite')) return 'onsite'
  return 'unknown'
}

async function fetchPage(keyword: string, geoId: string, start: number): Promise<ScrapedJob[]> {
  const { data: html } = await axios.get(LI_GUEST_API, {
    headers: HEADERS,
    params: {
      keywords: keyword,
      geoId,
      f_TPR: 'r2592000', // posted in last 30 days
      f_WT: '2',         // 2 = remote filter (optional, broadens search)
      start,
      count: 25,
    },
    timeout: 15_000,
  })

  const $ = cheerio.load(html)
  const jobs: ScrapedJob[] = []

  $('li').each((_, li) => {
    const card = $(li).find('.base-card, [data-entity-urn]').first()
    if (!card.length) return

    const titleEl = card.find('.base-search-card__title, h3').first()
    const companyEl = card.find('.base-search-card__subtitle, h4').first()
    const locationEl = card.find('.job-search-card__location, .base-search-card__metadata').first()
    const linkEl = card.find('a.base-card__full-link, a[href*="/jobs/view/"]').first()
    const timeEl = card.find('time, .job-search-card__listdate').first()

    const title = titleEl.text().trim()
    const company = companyEl.text().trim()
    const location = locationEl.text().trim()
    const href = linkEl.attr('href')
    const dateText = timeEl.attr('datetime') || timeEl.text().trim()

    if (!title || !href) return

    // Canonical URL without tracking params
    let url: string
    try {
      const u = new URL(href, 'https://www.linkedin.com')
      url = `${u.origin}${u.pathname}`
    } catch {
      url = href
    }

    jobs.push({
      title,
      company,
      url,
      location,
      remoteType: inferRemoteType(title, location),
      postedAt: dateText
        ? (dateText.includes('T') ? new Date(dateText).toISOString() : parsePostedAt(dateText))
        : undefined,
      source: 'linkedin',
    })
  })

  return jobs
}

export async function scrapeLinkedIn(keywords: string[]): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = []
  const seen = new Set<string>()

  for (const keyword of keywords) {
    // Fetch pages 0, 25, 50 (up to 75 results per keyword)
    for (const start of [0, 25, 50]) {
      try {
        const page = await fetchPage(keyword, DENVER_GEO_ID, start)
        for (const job of page) {
          if (!seen.has(job.url)) {
            seen.add(job.url)
            jobs.push(job)
          }
        }
        if (page.length < 25) break // no more results
        await sleep(1500 + Math.random() * 1000)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[linkedin] Error for "${keyword}" start=${start}: ${msg}`)
        break
      }
    }

    await sleep(2000 + Math.random() * 1000)
  }

  return jobs
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}
