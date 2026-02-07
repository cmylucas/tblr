import * as fs from 'fs'
import { resolveCik } from './tickerResolver'

export interface CikExtractionResult {
  cik?: string
  ticker?: string
  method: 'cik-text' | 'ticker-text' | 'ticker-filename' | 'none'
}

/**
 * Extract CIK from a PDF file (first 1-2 pages only).
 * Tries multiple strategies:
 * 1. Direct CIK pattern in PDF text
 * 2. Ticker symbol pattern in PDF text
 * 3. Ticker from filename pattern
 */
export async function extractCikFromPdf(pdfPath: string, filename: string): Promise<CikExtractionResult> {
  // Extract text from first 2 pages
  const text = await extractPdfPages(pdfPath, 2)

  // Strategy 1: Look for CIK in text
  const cikPatterns = [
    /CIK[:\s#-]*0*(\d{6,10})/i,
    /Central\s+Index\s+Key[:\s]*0*(\d{6,10})/i,
    /Commission\s+File\s+Number[:\s]*\d+-0*(\d{6,10})/i,
  ]

  for (const pattern of cikPatterns) {
    const match = text.match(pattern)
    if (match) {
      const cik = match[1].padStart(10, '0')
      console.log(`[cikExtractor] Found CIK in text: ${cik}`)
      return { cik, method: 'cik-text' }
    }
  }

  // Strategy 2: Look for ticker in text
  const tickerPatterns = [
    /Trading\s+Symbol[:\s]*([A-Z]{1,5})/,
    /Ticker\s+Symbol[:\s]*([A-Z]{1,5})/,
    /Nasdaq[:\s]*([A-Z]{1,5})/,
    /NYSE[:\s]*([A-Z]{1,5})/,
  ]

  for (const pattern of tickerPatterns) {
    const match = text.match(pattern)
    if (match) {
      const ticker = match[1]
      const cik = resolveCik(ticker)
      if (cik) {
        console.log(`[cikExtractor] Found ticker in text: ${ticker} → CIK ${cik}`)
        return { cik, ticker, method: 'ticker-text' }
      }
    }
  }

  // Strategy 3: Extract ticker from filename
  // Patterns: "AAPL_10K.pdf", "TSLA-Q4-2023.pdf", "META 10-K 2024.pdf"
  const filenameTickerPattern = /^([A-Z]{1,5})[-_\s]/
  const filenameMatch = filename.match(filenameTickerPattern)
  if (filenameMatch) {
    const ticker = filenameMatch[1]
    const cik = resolveCik(ticker)
    if (cik) {
      console.log(`[cikExtractor] Found ticker in filename: ${ticker} → CIK ${cik}`)
      return { cik, ticker, method: 'ticker-filename' }
    }
  }

  console.log('[cikExtractor] Could not detect CIK or ticker')
  return { method: 'none' }
}

/**
 * Extract text from the first N pages of a PDF using pdfjs-dist.
 * Does NOT apply redaction (needed for CIK/ticker detection).
 */
async function extractPdfPages(pdfPath: string, maxPages: number): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')

  const data = new Uint8Array(fs.readFileSync(pdfPath))
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    disableAutoFetch: true,
  }).promise

  const pages: string[] = []
  const pageCount = Math.min(maxPages, doc.numPages)

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }

  return pages.join('\n')
}
