/**
 * Insights Cache
 * Caches AI analysis results to reduce API costs
 * Invalidates when underlying data changes
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

interface CacheEntry<T = unknown> {
  key: string
  data: T
  timestamp: number
  spreadsheetId: string
  dataHash: string
  ttl: number
}

class InsightsCache {
  private cachePath: string
  private cache: Map<string, CacheEntry>

  constructor() {
    this.cachePath = path.join(
      app.getPath('userData'),
      'ai-insights-cache.json'
    )
    this.cache = new Map()
    this.load()
  }

  /**
   * Load cache from disk
   */
  private load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const data = fs.readFileSync(this.cachePath, 'utf-8')
        const entries: CacheEntry[] = JSON.parse(data)

        // Load entries that haven't expired
        const now = Date.now()
        for (const entry of entries) {
          if (now - entry.timestamp < entry.ttl) {
            this.cache.set(entry.key, entry)
          }
        }
      }
    } catch (err) {
      console.error('Failed to load cache:', err)
      // If cache is corrupted, start fresh
      this.cache.clear()
    }
  }

  /**
   * Save cache to disk
   */
  private save(): void {
    try {
      const entries = Array.from(this.cache.values())
      fs.writeFileSync(
        this.cachePath,
        JSON.stringify(entries, null, 2),
        { mode: 0o600 }
      )
    } catch (err) {
      console.error('Failed to save cache:', err)
    }
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.save()
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(
    key: string,
    data: T,
    ttl: number,
    spreadsheetId = '',
    dataHash = ''
  ): void {
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      spreadsheetId,
      dataHash,
      ttl,
    }

    this.cache.set(key, entry)
    this.save()
  }

  /**
   * Invalidate all cache entries for a specific spreadsheet
   */
  invalidateForSheet(spreadsheetId: string): void {
    let invalidated = 0
    for (const [key, entry] of this.cache.entries()) {
      if (entry.spreadsheetId === spreadsheetId) {
        this.cache.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      this.save()
      console.log(
        `[cache] Invalidated ${invalidated} entries for sheet ${spreadsheetId}`
      )
    }
  }

  /**
   * Invalidate cache entries with different data hash
   * This detects when underlying data has changed
   */
  invalidateByHash(dataHash: string): boolean {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.dataHash && entry.dataHash !== dataHash) {
        this.cache.delete(key)
        this.save()
        console.log(
          `[cache] Invalidated ${key} due to data change`
        )
        return true
      }
    }
    return false
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.save()
    console.log('[cache] Cleared all entries')
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number
    totalSize: number
    oldestEntry: number | null
  } {
    const entries = Array.from(this.cache.values())
    const totalSize = JSON.stringify(entries).length
    const oldestEntry =
      entries.length > 0
        ? Math.min(...entries.map((e) => e.timestamp))
        : null

    return {
      entries: entries.length,
      totalSize,
      oldestEntry,
    }
  }
}

// Singleton instance
export const insightsCache = new InsightsCache()
