import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import type { DatasetMeta } from './datasetTypes'
import type { IpcResult, AuditEntry } from '../shared/types'
import type { CsvPreview, AttachmentChunk, ChunkCursor, ImportResult } from '../attachments/types'
import {
  createDataset,
  createDatasetFromCsv,
  listDatasets,
  getDataset,
  deleteDataset,
  updateDataset,
  getDatasetPreview,
  readDatasetChunk,
  getDatasetPath,
} from './datasetStore'
import { validateForImport, parseFile } from '../attachments/parseCsvTsv'
import {
  addSheet,
  writeRange,
  formatRange,
  setBasicFilter,
  freezeRowsCols,
  indexToColLetter,
} from '../sheets/sheetsClient'
import { processPdfWithSec } from '../sec/secProcessor'
import { processPdfWithLlm } from '../sec/llmSecProcessor'
import { getFlag } from '../featureFlags'
import { randomUUID } from 'crypto'

// IPC channel names
export const DATASET_IPC = {
  OPEN_UPLOAD_DIALOG: 'datasets:openUploadDialog',
  PROMPT_TICKER: 'datasets:promptTicker',
  LIST: 'datasets:list',
  GET_PREVIEW: 'datasets:getPreview',
  READ_CHUNK: 'datasets:readChunk',
  DELETE: 'datasets:delete',
  IMPORT_TO_SHEETS: 'datasets:importToSheets',
  BUILD_DB: 'datasets:buildDb',
} as const

/**
 * Register all dataset IPC handlers.
 * addAudit, getCurrentSpreadsheetId, and getCurrentSheetNames are injected from ipc.ts.
 */
export function registerDatasetHandlers(
  addAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void,
  getCurrentSpreadsheetId: () => string | undefined,
  getCurrentSheetNames: () => string[]
): void {
  // ── Open file dialog, create dataset ──
  ipcMain.handle(DATASET_IPC.OPEN_UPLOAD_DIALOG, async (): Promise<IpcResult<DatasetMeta>> => {
    try {
      // Show file dialog
      const result = await dialog.showOpenDialog({
        title: 'Upload Dataset',
        filters: [
          { name: 'Supported Files', extensions: ['pdf', 'csv', 'tsv'] },
          { name: 'SEC Filings (PDF)', extensions: ['pdf'] },
          { name: 'CSV / TSV Files', extensions: ['csv', 'tsv'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: 'No file selected' }
      }

      const filePath = result.filePaths[0]
      const filename = path.basename(filePath)
      const ext = path.extname(filePath).toLowerCase()

      if (ext === '.csv' || ext === '.tsv') {
        // Direct CSV/TSV upload
        const metadata = createDataset(filePath, {
          name: filename.replace(/\.(csv|tsv)$/i, ''),
          source: {
            type: 'upload',
            original: { filename },
          },
        })

        addAudit({
          operation: 'dataset:upload',
          success: true,
          message: `${filename} (${metadata.stats.rowCount} rows, ${metadata.stats.colCount} cols)`,
        })

        return { ok: true, data: metadata }
      } else if (ext === '.pdf') {
        // SEC PDF processing - check feature flag
        const useEdgar = getFlag('SEC_USE_EDGAR')
        console.log(`[datasetsIpc] Processing PDF with ${useEdgar ? 'EDGAR API' : 'LLM'}`)

        try {
          if (useEdgar) {
            // EDGAR API path (existing behavior)
            const secResult = await processPdfWithSec(filePath, filename)

          // Parse the generated CSV to get stats
          const { rows, delimiter } = parseFile(secResult.csvPath)
          const colCount = Math.max(...rows.map((r) => r.length), 0)

          // Create dataset metadata
          const metadata: DatasetMeta = {
            datasetId: secResult.datasetId,
            name: secResult.ticker ? `${secResult.ticker}_CompanyFacts` : `CIK${secResult.cik}_CompanyFacts`,
            type: 'csv',
            sizeBytes: 0, // Will be updated by createDatasetFromCsv
            uploadedAt: Date.now(),
            source: {
              type: 'sec-filing',
              secFiling: {
                pdfFilename: filename,
                cik: secResult.cik,
                ticker: secResult.ticker,
                detectionMethod: secResult.detectionMethod as any,
              },
            },
            stats: {
              rowCount: rows.length - 1,
              colCount,
              delimiter: ',',
              headers: rows.length > 0 ? rows[0] : [],
            },
          }

          // Create dataset from SEC-generated CSV
          const finalMetadata = createDatasetFromCsv(secResult.csvPath, metadata)

          // Auto-build DB for large SEC datasets (>1000 rows)
          if (metadata.stats.rowCount > 1000) {
            try {
              const { createDatasetDb } = await import('../db/datasetDb')
              const dbInfo = createDatasetDb(metadata.datasetId, secResult.csvPath)
              ;(finalMetadata as any).dbInfo = dbInfo

              addAudit({
                operation: 'dataset:db-build',
                success: true,
                message: `Built queryable DB for ${metadata.name} (${dbInfo.rowCount} rows, summary: ${dbInfo.summaryCreated ? 'yes' : 'no'})`,
              })
            } catch (dbErr: any) {
              console.error('[datasetsIpc] Failed to build DB:', dbErr)
              addAudit({
                operation: 'dataset:db-build',
                success: false,
                message: `DB build failed: ${dbErr.message}`,
              })
            }
          }

            addAudit({
              operation: 'dataset:sec-edgar',
              success: true,
              message: `${filename} → ${metadata.name} (${metadata.stats.rowCount} rows, EDGAR API)`,
            })

            return { ok: true, data: finalMetadata }
          } else {
            // LLM conversion path
            const llmResult = await processPdfWithLlm(filePath, filename)

            // Parse the generated CSV to get stats
            const { rows, delimiter } = parseFile(llmResult.csvPath)
            const colCount = Math.max(...rows.map((r) => r.length), 0)

            // Create dataset metadata
            const metadata: DatasetMeta = {
              datasetId: llmResult.datasetId,
              name: filename.replace(/\.pdf$/i, '_LLM'),
              type: 'csv',
              sizeBytes: 0,
              uploadedAt: Date.now(),
              source: {
                type: 'sec-filing',
                secFiling: {
                  pdfFilename: filename,
                  cik: 'N/A',
                  ticker: undefined,
                  detectionMethod: 'llm-conversion' as any,
                },
              },
              stats: {
                rowCount: rows.length - 1,
                colCount,
                delimiter: ',',
                headers: rows.length > 0 ? rows[0] : [],
              },
            }

            const finalMetadata = createDatasetFromCsv(llmResult.csvPath, metadata)

            addAudit({
              operation: 'dataset:sec-llm',
              success: true,
              message: `${filename} → ${metadata.name} (${metadata.stats.rowCount} rows, LLM)`,
            })

            return { ok: true, data: finalMetadata }
          }
        } catch (err: any) {
          if (err.message === 'CIK_NOT_FOUND' && useEdgar) {
            // Return special error to trigger ticker input modal (only for EDGAR path)
            return {
              ok: false,
              error: 'CIK_NOT_FOUND',
              data: { pdfPath: filePath, filename } as any,
            }
          }
          throw err
        }
      } else {
        return { ok: false, error: 'Unsupported file type' }
      }
    } catch (err: any) {
      addAudit({
        operation: 'dataset:upload',
        success: false,
        message: err.message,
      })
      return { ok: false, error: err.message }
    }
  })

  // ── Prompt for ticker (for SEC PDF processing) ──
  ipcMain.handle(
    DATASET_IPC.PROMPT_TICKER,
    async (_e, pdfPath: string, filename: string, ticker: string): Promise<IpcResult<DatasetMeta>> => {
      try {
        // Process PDF with user-provided ticker
        const secResult = await processPdfWithSec(pdfPath, filename, ticker)

        // Parse the generated CSV to get stats
        const { rows, delimiter } = parseFile(secResult.csvPath)
        const colCount = Math.max(...rows.map((r) => r.length), 0)

        // Create dataset metadata
        const metadata: DatasetMeta = {
          datasetId: secResult.datasetId,
          name: `${secResult.ticker}_CompanyFacts`,
          type: 'csv',
          sizeBytes: 0,
          uploadedAt: Date.now(),
          source: {
            type: 'sec-filing',
            secFiling: {
              pdfFilename: filename,
              cik: secResult.cik,
              ticker: secResult.ticker,
              detectionMethod: 'user-input',
            },
          },
          stats: {
            rowCount: rows.length - 1,
            colCount,
            delimiter: ',',
            headers: rows.length > 0 ? rows[0] : [],
          },
        }

        // Create dataset from SEC-generated CSV
        const finalMetadata = createDatasetFromCsv(secResult.csvPath, metadata)

        addAudit({
          operation: 'dataset:sec-convert',
          success: true,
          message: `${filename} → ${metadata.name} (user input: ${ticker}, ${metadata.stats.rowCount} rows)`,
        })

        return { ok: true, data: finalMetadata }
      } catch (err: any) {
        addAudit({
          operation: 'dataset:sec-convert',
          success: false,
          message: `${filename}: ${err.message}`,
        })
        return { ok: false, error: err.message }
      }
    }
  )

  // ── List all datasets ──
  ipcMain.handle(DATASET_IPC.LIST, async (): Promise<IpcResult<DatasetMeta[]>> => {
    return { ok: true, data: listDatasets() }
  })

  // ── Get dataset preview ──
  ipcMain.handle(DATASET_IPC.GET_PREVIEW, async (_e, datasetId: string): Promise<IpcResult<CsvPreview>> => {
    try {
      const preview = getDatasetPreview(datasetId)
      return { ok: true, data: preview }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  // ── Read dataset chunk ──
  ipcMain.handle(
    DATASET_IPC.READ_CHUNK,
    async (_e, datasetId: string, cursor: ChunkCursor): Promise<IpcResult<AttachmentChunk>> => {
      try {
        const chunk = readDatasetChunk(datasetId, cursor)
        return { ok: true, data: chunk }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    }
  )

  // ── Delete dataset ──
  ipcMain.handle(DATASET_IPC.DELETE, async (_e, datasetId: string): Promise<IpcResult> => {
    try {
      const meta = getDataset(datasetId)
      if (!meta) return { ok: false, error: 'Dataset not found' }

      deleteDataset(datasetId)
      addAudit({
        operation: 'dataset:delete',
        success: true,
        message: `${meta.name} (${meta.stats.rowCount} rows)`,
      })
      return { ok: true }
    } catch (err: any) {
      addAudit({
        operation: 'dataset:delete',
        success: false,
        message: err.message,
      })
      return { ok: false, error: err.message }
    }
  })

  // ── Import dataset to Google Sheets ──
  ipcMain.handle(
    DATASET_IPC.IMPORT_TO_SHEETS,
    async (_e, datasetId: string, sheetName: string): Promise<IpcResult<ImportResult>> => {
      try {
        const spreadsheetId = getCurrentSpreadsheetId()
        if (!spreadsheetId) {
          return { ok: false, error: 'No spreadsheet attached. Attach a Google Sheet first.' }
        }

        const meta = getDataset(datasetId)
        if (!meta) return { ok: false, error: 'Dataset not found' }

        const dataPath = getDatasetPath(datasetId)

        // Validate dataset for import
        const { valid, error, rows } = validateForImport(dataPath)
        if (!valid) return { ok: false, error }

        if (rows.length === 0) return { ok: false, error: 'Dataset is empty' }

        // Calculate dimensions
        const colCount = Math.max(...rows.map((r) => r.length))
        const rowCount = rows.length

        // Create new sheet with enough rows and columns
        await addSheet(spreadsheetId, sheetName, {
          rowCount: Math.max(rowCount, 1000), // At least 1000 rows
          columnCount: Math.max(colCount, 26), // At least 26 columns (A-Z)
        })

        // Write data in batches (reuse pattern from attachmentsIpc.ts)
        const BATCH_SIZE = 5000
        const endCol = indexToColLetter(colCount - 1)

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          // Pad rows to consistent column count
          const padded = batch.map((r) => {
            const row = [...r]
            while (row.length < colCount) row.push('')
            return row
          })
          const startRow = i + 1
          const endRow = i + padded.length
          const range = `${sheetName}!A${startRow}:${endCol}${endRow}`
          await writeRange(spreadsheetId, range, padded)
        }

        // Format: bold header, freeze row 1, set filter, column widths
        if (rows.length > 0) {
          const headerRange = `${sheetName}!A1:${endCol}1`
          const dataRange = `${sheetName}!A1:${endCol}${rows.length}`

          try {
            await formatRange(spreadsheetId, headerRange, { bold: true, columnWidth: 160 })
          } catch {
            /* non-critical */
          }

          try {
            await freezeRowsCols(spreadsheetId, sheetName, 1, 0)
          } catch {
            /* non-critical */
          }

          try {
            await setBasicFilter(spreadsheetId, dataRange)
          } catch {
            /* non-critical */
          }
        }

        const result: ImportResult = {
          sheetName,
          rowsWritten: rows.length,
          colsWritten: colCount,
          spreadsheetId,
        }

        addAudit({
          operation: 'dataset:import',
          spreadsheetId,
          success: true,
          rowCount: rows.length,
          colCount,
          message: `${meta.name} → "${sheetName}" (${rows.length} rows, ${colCount} cols)`,
        })

        return { ok: true, data: result }
      } catch (err: any) {
        addAudit({
          operation: 'dataset:import',
          success: false,
          message: err.message,
        })
        return { ok: false, error: err.message }
      }
    }
  )

  // ── Build DB for existing dataset ──
  ipcMain.handle(DATASET_IPC.BUILD_DB, async (_e, datasetId: string): Promise<IpcResult<DatasetMeta>> => {
    try {
      const meta = getDataset(datasetId)
      if (!meta) {
        return { ok: false, error: 'Dataset not found' }
      }

      // Check if DB already exists
      if ((meta as any).dbInfo) {
        return { ok: false, error: 'Dataset already has a database' }
      }

      // Get dataset path
      const csvPath = getDatasetPath(datasetId)

      // Build DB
      const { createDatasetDb } = await import('../db/datasetDb')
      const dbInfo = createDatasetDb(datasetId, csvPath)

      // Update metadata with dbInfo
      const updatedMeta = updateDataset(datasetId, { dbInfo } as any)

      addAudit({
        operation: 'dataset:buildDb',
        success: true,
        message: `Built database for ${meta.name} (${dbInfo.rowCount} rows, summary: ${dbInfo.summaryCreated})`,
      })

      return { ok: true, data: updatedMeta }
    } catch (err: any) {
      addAudit({
        operation: 'dataset:buildDb',
        success: false,
        message: err.message,
      })
      return { ok: false, error: err.message }
    }
  })

  console.log('[datasetsIpc] all handlers registered')
}
