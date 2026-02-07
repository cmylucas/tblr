import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { SecClient } from './secClient'
import { loadTickerCache, resolveCik, resolveTicker } from './tickerResolver'
import { extractCikFromPdf } from './cikExtractor'
import { flattenCompanyFactsToCsv, writeCsvFile, type CompanyFacts } from './csvFlattener'
import type { DatasetMeta } from '../datasets/datasetTypes'

export interface SecProcessingResult {
  datasetId: string
  cik: string
  ticker?: string
  detectionMethod: string
  rowCount: number
  colCount: number
  csvPath: string
}

/**
 * Process a PDF SEC filing:
 * 1. Extract CIK from PDF or use user-provided ticker
 * 2. Fetch companyfacts XBRL from SEC EDGAR API
 * 3. Flatten to CSV
 * 4. Return metadata for dataset creation
 */
export async function processPdfWithSec(
  pdfPath: string,
  pdfFilename: string,
  userProvidedTicker?: string
): Promise<SecProcessingResult> {
  const client = new SecClient()
  const cacheDir = path.join(app.getPath('userData'), 'sec-cache')
  fs.mkdirSync(cacheDir, { recursive: true })

  console.log(`[secProcessor] Processing PDF: ${pdfFilename}`)

  // Step 1: Load ticker cache
  await loadTickerCache(client, cacheDir)

  // Step 2: Extract CIK (or use user-provided ticker)
  let cik: string
  let ticker: string | undefined
  let detectionMethod: string

  if (userProvidedTicker) {
    const resolvedCik = resolveCik(userProvidedTicker)
    if (!resolvedCik) {
      throw new Error(`Could not resolve ticker: ${userProvidedTicker}`)
    }
    cik = resolvedCik
    ticker = userProvidedTicker.toUpperCase()
    detectionMethod = 'user-input'
    console.log(`[secProcessor] Using user-provided ticker: ${ticker} → CIK ${cik}`)
  } else {
    const extraction = await extractCikFromPdf(pdfPath, pdfFilename)
    if (!extraction.cik) {
      throw new Error('CIK_NOT_FOUND')
    }
    cik = extraction.cik
    ticker = extraction.ticker || resolveTicker(cik) || undefined
    detectionMethod = extraction.method
    console.log(`[secProcessor] Auto-detected CIK: ${cik} (method: ${detectionMethod})`)
  }

  // Step 3: Fetch companyfacts XBRL
  console.log(`[secProcessor] Fetching companyfacts for CIK ${cik}...`)
  const facts = await fetchCompanyFacts(cik, client)
  console.log(`[secProcessor] Fetched companyfacts for ${facts.entityName}`)

  // Step 4: Flatten to CSV
  const rows = flattenCompanyFactsToCsv(facts)

  // Step 5: Write to temp file
  const tempDir = path.join(app.getPath('temp'), 'sec-conversions')
  fs.mkdirSync(tempDir, { recursive: true })

  const datasetId = randomUUID()
  const csvPath = path.join(tempDir, `${datasetId}.csv`)
  writeCsvFile(rows, csvPath)

  return {
    datasetId,
    cik,
    ticker,
    detectionMethod,
    rowCount: rows.length - 1, // Exclude header
    colCount: rows[0].length,
    csvPath,
  }
}

/**
 * Fetch companyfacts XBRL JSON from SEC EDGAR API
 */
async function fetchCompanyFacts(cik: string, client: SecClient): Promise<CompanyFacts> {
  const paddedCik = cik.padStart(10, '0')
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`
  console.log(`[secProcessor] Fetching ${url}`)
  return await client.fetch(url)
}
