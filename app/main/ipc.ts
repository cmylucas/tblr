import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { IPC, type AuditEntry, type AppStatus, type IpcResult, type AnalysisResult } from './shared/types'
import { AttachSheetInput, ReadRangeInput, WriteRangeInput, AnalyzeFinancialDataInput } from './shared/schema'
import { signIn, signOut, isSignedIn, getEmail, tryRestoreSession } from './auth/googleAuth'
import { parseSheetUrl } from './sheets/parseSheetUrl'
import { getSpreadsheetMetadata, readRange, writeRange } from './sheets/sheetsClient'
import { parseFinancialData, validateColumnMapping } from './ai/financialParser'
import { aggregateTransactions, generateDataHash } from './ai/dataAggregator'
import { getDedalusClient } from './ai/dedalusClient'
import { insightsCache } from './ai/insightsCache'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// ── App state ──

let currentSpreadsheetId: string | undefined
let currentSheetNames: string[] = []
const auditLog: AuditEntry[] = []

// AI state
let lastAnalysisResult: AnalysisResult | null = null
let lastDataHash: string | null = null

function addAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  const full: AuditEntry = {
    ...entry,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  }
  auditLog.unshift(full)
  if (auditLog.length > 20) auditLog.length = 20
  console.log(`[audit] ${full.operation} ok=${full.success} ${full.message ?? ''}`)
}

/**
 * If range has no "!" (no sheet scope), prefix with the first sheet name.
 * Returns { range, warned } — warned is true if we defaulted.
 */
function ensureSheetScope(range: string): { range: string; warned: boolean } {
  if (range.includes('!')) return { range, warned: false }
  if (currentSheetNames.length > 0) {
    const scoped = `${currentSheetNames[0]}!${range}`
    return { range: scoped, warned: true }
  }
  return { range, warned: false }
}

// ── Handlers ──

export function registerIpcHandlers(): void {
  // Try restoring session on startup
  tryRestoreSession().catch(() => {})

  ipcMain.handle(IPC.GET_STATUS, async (): Promise<IpcResult<AppStatus>> => {
    return {
      ok: true,
      data: {
        signedIn: isSignedIn(),
        email: getEmail(),
        attached: !!currentSpreadsheetId,
        spreadsheetId: currentSpreadsheetId,
        sheetNames: currentSheetNames,
      },
    }
  })

  ipcMain.handle(IPC.GET_AUDIT_LOG, async (): Promise<IpcResult<AuditEntry[]>> => {
    return { ok: true, data: auditLog }
  })

  ipcMain.handle(IPC.ATTACH_SHEET, async (_e, rawUrl: string): Promise<IpcResult<{ spreadsheetId: string; sheetNames: string[] }>> => {
    try {
      const { url } = AttachSheetInput.parse({ url: rawUrl })
      const { spreadsheetId } = parseSheetUrl(url)

      if (!isSignedIn()) {
        addAudit({ operation: 'attach', spreadsheetId, success: false, message: 'Not signed in' })
        return { ok: false, error: 'Not signed in. Please sign in first.' }
      }

      const meta = await getSpreadsheetMetadata(spreadsheetId)
      currentSpreadsheetId = spreadsheetId
      currentSheetNames = meta.sheetNames

      addAudit({ operation: 'attach', spreadsheetId, success: true, message: `"${meta.title}" — ${meta.sheetNames.length} sheets` })
      return { ok: true, data: { spreadsheetId, sheetNames: meta.sheetNames } }
    } catch (err: any) {
      addAudit({ operation: 'attach', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.SIGN_IN, async (): Promise<IpcResult<string>> => {
    try {
      const email = await signIn()
      addAudit({ operation: 'signIn', success: true, message: email ?? 'signed in' })
      return { ok: true, data: email }
    } catch (err: any) {
      addAudit({ operation: 'signIn', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.SIGN_OUT, async (): Promise<IpcResult> => {
    try {
      await signOut()
      currentSpreadsheetId = undefined
      currentSheetNames = []
      addAudit({ operation: 'signOut', success: true })
      return { ok: true }
    } catch (err: any) {
      addAudit({ operation: 'signOut', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.READ_RANGE, async (_e, rawRange: string): Promise<IpcResult<string[][]>> => {
    try {
      const { range: parsedRange } = ReadRangeInput.parse({ range: rawRange })
      if (!currentSpreadsheetId) {
        return { ok: false, error: 'No sheet attached' }
      }
      if (!isSignedIn()) {
        return { ok: false, error: 'Not signed in' }
      }

      const { range, warned } = ensureSheetScope(parsedRange)
      if (warned) {
        addAudit({ operation: 'read', spreadsheetId: currentSpreadsheetId, range, success: true, message: `Defaulted to sheet "${currentSheetNames[0]}"` })
      }

      const values = await readRange(currentSpreadsheetId, range)
      const rows = values.length
      const cols = values[0]?.length ?? 0
      addAudit({ operation: 'read', spreadsheetId: currentSpreadsheetId, range, rowCount: rows, colCount: cols, success: true })
      return { ok: true, data: values }
    } catch (err: any) {
      addAudit({ operation: 'read', spreadsheetId: currentSpreadsheetId, range: rawRange, success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle(IPC.WRITE_RANGE, async (_e, rawRange: string, rawText: string): Promise<IpcResult> => {
    try {
      const { range: parsedRange, rawText: text } = WriteRangeInput.parse({ range: rawRange, rawText })
      if (!currentSpreadsheetId) {
        return { ok: false, error: 'No sheet attached' }
      }
      if (!isSignedIn()) {
        return { ok: false, error: 'Not signed in' }
      }

      const { range, warned } = ensureSheetScope(parsedRange)
      if (warned) {
        addAudit({ operation: 'write', spreadsheetId: currentSpreadsheetId, range, success: true, message: `Defaulted to sheet "${currentSheetNames[0]}"` })
      }

      // Parse TSV/CSV: rows are newline-separated, cols tab-separated (or comma if no tabs)
      const rows = text.split('\n').filter((r) => r.length > 0)
      const hasTabs = rows.some((r) => r.includes('\t'))
      const values = rows.map((r) => r.split(hasTabs ? '\t' : ','))

      const result = await writeRange(currentSpreadsheetId, range, values)
      addAudit({
        operation: 'write',
        spreadsheetId: currentSpreadsheetId,
        range,
        rowCount: result.updatedRows,
        colCount: result.updatedColumns,
        success: true,
      })
      return { ok: true, data: result }
    } catch (err: any) {
      addAudit({ operation: 'write', spreadsheetId: currentSpreadsheetId, range: rawRange, success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  // AI: Analyze Financial Data
  ipcMain.handle(
    IPC.AI_ANALYZE_FINANCIAL_DATA,
    async (_e, rawRange: string, mapping: any, context?: string): Promise<IpcResult<AnalysisResult>> => {
      try {
        const { range, mapping: validatedMapping, context: userContext } = AnalyzeFinancialDataInput.parse({
          range: rawRange,
          mapping,
          context,
        })

        if (!currentSpreadsheetId) {
          return { ok: false, error: 'No sheet attached' }
        }
        if (!isSignedIn()) {
          return { ok: false, error: 'Not signed in' }
        }

        // Check if Dedalus API key is configured
        const apiKey = process.env.DEDALUS_API_KEY
        if (!apiKey || apiKey === 'your-dedalus-api-key') {
          return {
            ok: false,
            error: 'Dedalus API key not configured. Please add DEDALUS_API_KEY to your .env file.',
          }
        }

        // Read data from sheet
        const { range: scopedRange } = ensureSheetScope(range)
        const values = await readRange(currentSpreadsheetId, scopedRange)

        if (values.length === 0) {
          return { ok: false, error: 'No data found in range' }
        }

        // Validate column mapping
        const validation = validateColumnMapping(values, validatedMapping)
        if (!validation.valid) {
          return { ok: false, error: `Invalid column mapping: ${validation.errors.join(', ')}` }
        }

        // Parse financial data
        const parseResult = parseFinancialData(values, validatedMapping, 1) // Skip header row

        if (parseResult.errors.length > 0 && parseResult.transactions.length === 0) {
          return {
            ok: false,
            error: `Failed to parse data: ${parseResult.errors[0].reason} at row ${parseResult.errors[0].row}`,
          }
        }

        if (parseResult.transactions.length === 0) {
          return { ok: false, error: 'No valid transactions found' }
        }

        // Generate data hash for cache invalidation
        const dataHash = generateDataHash(parseResult.transactions)

        // Check cache
        const cacheKey = `analysis:${currentSpreadsheetId}:${scopedRange}:${dataHash}`
        const cached = insightsCache.get<AnalysisResult>(cacheKey)
        if (cached) {
          console.log('[ai] Using cached analysis')
          addAudit({
            operation: 'ai:analyze',
            spreadsheetId: currentSpreadsheetId,
            range: scopedRange,
            rowCount: parseResult.transactions.length,
            success: true,
            message: 'Used cached analysis',
          })
          lastAnalysisResult = cached
          lastDataHash = dataHash
          return { ok: true, data: cached }
        }

        // Aggregate data (privacy-safe)
        const summary = aggregateTransactions(parseResult.transactions)

        // Call Dedalus AI
        const dedalus = getDedalusClient(apiKey, process.env.DEDALUS_MODEL)
        const aiResponse = await dedalus.analyzeSpendingSummary(summary, userContext)

        // Prepare result
        const result: AnalysisResult = {
          ...aiResponse,
          transactionCount: parseResult.transactions.length,
          dateRange: summary.dateRange,
        }

        // Cache result (1 hour TTL)
        insightsCache.set(cacheKey, result, 3600000, currentSpreadsheetId, dataHash)

        // Store in state
        lastAnalysisResult = result
        lastDataHash = dataHash

        addAudit({
          operation: 'ai:analyze',
          spreadsheetId: currentSpreadsheetId,
          range: scopedRange,
          rowCount: parseResult.transactions.length,
          success: true,
          message: `Analyzed ${parseResult.transactions.length} transactions, ${parseResult.errors.length} errors`,
        })

        return { ok: true, data: result }
      } catch (err: any) {
        console.error('[ai] Analysis failed:', err)
        addAudit({
          operation: 'ai:analyze',
          spreadsheetId: currentSpreadsheetId,
          range: rawRange,
          success: false,
          message: err.message,
        })
        return { ok: false, error: err.message }
      }
    }
  )

  // AI: Get Last Insights (cached)
  ipcMain.handle(IPC.AI_GET_INSIGHTS, async (): Promise<IpcResult<AnalysisResult>> => {
    if (!lastAnalysisResult) {
      return { ok: false, error: 'No analysis available. Please analyze financial data first.' }
    }
    return { ok: true, data: lastAnalysisResult }
  })

  console.log('[ipc] all handlers registered')
}
