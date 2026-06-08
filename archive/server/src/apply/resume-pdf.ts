import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Tiny markdown → HTML for our own resume format (## headings, **bold**, - bullets).
 * Not a general markdown parser — just what the resume generator emits.
 */
function mdToHtml(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let inList = false

  const inline = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

  const closeList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line.trim()) {
      closeList()
      continue
    }
    if (/^#{3}\s/.test(line)) {
      closeList()
      out.push(`<h3>${inline(line.replace(/^#{3}\s/, ''))}</h3>`)
    } else if (/^#{2}\s/.test(line)) {
      closeList()
      out.push(`<h2>${inline(line.replace(/^#{2}\s/, ''))}</h2>`)
    } else if (/^#\s/.test(line)) {
      closeList()
      out.push(`<h1>${inline(line.replace(/^#\s/, ''))}</h1>`)
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s/, ''))}</li>`)
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('\n')
}

const CSS = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a2e;
    line-height: 1.45;
    font-size: 11pt;
    margin: 0;
    padding: 48px 56px;
  }
  h1 { font-size: 22pt; margin: 0 0 2px; letter-spacing: -0.5px; }
  h2 {
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #2a5db0;
    border-bottom: 1.5px solid #2a5db0;
    padding-bottom: 3px;
    margin: 18px 0 8px;
  }
  h3 { font-size: 11.5pt; margin: 10px 0 2px; }
  p { margin: 4px 0; }
  ul { margin: 4px 0 8px; padding-left: 20px; }
  li { margin: 2px 0; }
  a { color: #2a5db0; text-decoration: none; }
  strong { color: #111; }
`

/** Render resume markdown to a print-ready PDF. Returns the file path. */
export async function renderResumePdf(markdown: string, outPath: string): Promise<string> {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${mdToHtml(
    markdown
  )}</body></html>`

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.pdf({
      path: outPath,
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
  } finally {
    await browser.close()
  }
  return outPath
}
