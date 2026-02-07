import * as fs from 'fs'
import * as path from 'path'
import type { SecClient } from './secClient'

interface TickerEntry {
  cik: string
  ticker: string
  title: string
}

// In-memory cache of ticker → CIK and CIK → ticker mappings
let tickerCache: Map<string, TickerEntry> | null = null

/**
 * Load the company_tickers.json file from SEC and cache it.
 * The cache file is stored in the SEC cache directory with a 24-hour TTL.
 */
export async function loadTickerCache(client: SecClient, cacheDir: string): Promise<void> {
  if (tickerCache) return // Already loaded

  const cachePath = path.join(cacheDir, 'company_tickers.json')
  let data: any

  // Try to load from cache file first
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath)
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)

    // Use cache if less than 24 hours old
    if (ageHours < 24) {
      console.log(`[tickerResolver] Using cached company_tickers.json (${ageHours.toFixed(1)}h old)`)
      data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    }
  }

  // Fetch from SEC if not cached or stale
  if (!data) {
    console.log('[tickerResolver] Fetching company_tickers.json from SEC...')
    data = await client.fetch('https://www.sec.gov/files/company_tickers.json')

    // Save to cache
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf-8')
    console.log('[tickerResolver] Cached company_tickers.json')
  }

  // Build in-memory map: both ticker → entry and CIK → entry
  tickerCache = new Map()
  for (const entry of Object.values(data)) {
    const e = entry as any
    const cikStr = String(e.cik_str).padStart(10, '0')
    const tickerEntry: TickerEntry = {
      cik: cikStr,
      ticker: e.ticker,
      title: e.title,
    }

    // Map both ticker (uppercase) and CIK to the same entry
    tickerCache.set(e.ticker.toUpperCase(), tickerEntry)
    tickerCache.set(cikStr, tickerEntry)
  }

  console.log(`[tickerResolver] Loaded ${tickerCache.size / 2} companies`)
}

/**
 * Resolve a ticker or CIK to a 10-digit padded CIK.
 * Returns null if not found.
 */
export function resolveCik(tickerOrCik: string): string | null {
  if (!tickerCache) {
    console.error('[tickerResolver] Ticker cache not loaded!')
    return null
  }

  // Try as ticker (uppercase)
  let entry = tickerCache.get(tickerOrCik.toUpperCase())
  if (entry) return entry.cik

  // Try as CIK (pad to 10 digits)
  const paddedCik = tickerOrCik.padStart(10, '0')
  entry = tickerCache.get(paddedCik)
  if (entry) return entry.cik

  return null
}

/**
 * Resolve a CIK to its ticker symbol.
 * Returns null if not found.
 */
export function resolveTicker(cik: string): string | null {
  if (!tickerCache) {
    console.error('[tickerResolver] Ticker cache not loaded!')
    return null
  }

  const paddedCik = cik.padStart(10, '0')
  const entry = tickerCache.get(paddedCik)
  return entry ? entry.ticker : null
}
