export interface ScrapedJob {
  title: string
  company: string
  url: string
  description?: string
  location?: string
  remoteType?: 'remote' | 'hybrid' | 'onsite' | 'unknown'
  salaryMin?: number
  salaryMax?: number
  salaryRaw?: string
  postedAt?: string        // ISO date string
  source: string
  rawData?: Record<string, unknown>
}

export interface ScraperResult {
  source: string
  jobs: ScrapedJob[]
  error?: string
}

export interface BaseScraper {
  source: string
  scrape(keywords: string[], location: string): Promise<ScrapedJob[]>
}
