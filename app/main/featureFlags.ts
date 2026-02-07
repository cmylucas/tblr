/**
 * Feature flags for tblr.
 *
 * These control experimental or conditional features in the app.
 * Flags can be modified at runtime or via environment variables.
 */

export interface FeatureFlags {
  /**
   * SEC_USE_EDGAR: Controls how SEC PDF filings are processed.
   *
   * When TRUE (default):
   * - Extract CIK from PDF
   * - Fetch structured XBRL data from SEC Edgar API
   * - Generate CSV from companyfacts JSON
   *
   * When FALSE:
   * - Send PDF to LLM (OpenRouter)
   * - Ask LLM to convert financial data to CSV format
   * - Use LLM's structured output
   *
   * Default: true
   */
  SEC_USE_EDGAR: boolean
}

// Default flag values
const DEFAULT_FLAGS: FeatureFlags = {
  SEC_USE_EDGAR: true,
}

// In-memory flags (can be modified at runtime)
let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS }

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return { ...currentFlags }
}

/**
 * Get a specific feature flag
 */
export function getFlag<K extends keyof FeatureFlags>(key: K): FeatureFlags[K] {
  return currentFlags[key]
}

/**
 * Set a feature flag at runtime
 */
export function setFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]): void {
  console.log(`[featureFlags] Setting ${key} = ${value}`)
  currentFlags[key] = value
}

/**
 * Reset all flags to defaults
 */
export function resetFlags(): void {
  console.log('[featureFlags] Resetting all flags to defaults')
  currentFlags = { ...DEFAULT_FLAGS }
}

/**
 * Initialize flags from environment variables (if present)
 * Call this on app startup.
 */
export function initializeFlags(): void {
  // Check for environment variable overrides
  if (process.env.SEC_USE_EDGAR !== undefined) {
    const value = process.env.SEC_USE_EDGAR.toLowerCase()
    currentFlags.SEC_USE_EDGAR = value === 'true' || value === '1'
    console.log(`[featureFlags] SEC_USE_EDGAR = ${currentFlags.SEC_USE_EDGAR} (from env)`)
  }

  console.log('[featureFlags] Initialized:', currentFlags)
}
