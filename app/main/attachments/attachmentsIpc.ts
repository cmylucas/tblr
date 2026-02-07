import { ipcMain } from 'electron'
import { openAndStore, getMeta, getAllMeta, removeMeta } from './fileStore'
import { getPreview as getCsvPreview, readChunk as readCsvChunk, validateForImport } from './parseCsvTsv'
import { getPreview as getPdfPreview, readChunk as readPdfChunk } from './extractPdfText'
import {
  addSheet,
  writeRange,
  formatRange,
  setBasicFilter,
  freezeRowsCols,
  indexToColLetter,
} from '../sheets/sheetsClient'
import type { AttachmentMeta, AttachmentPreview, AttachmentChunk, ChunkCursor, ImportResult } from './types'
import type { IpcResult, AuditEntry } from '../shared/types'

// IPC channel names
export const ATTACHMENT_IPC = {
  OPEN_DIALOG: 'attachments:openDialog',
  GET_PREVIEW: 'attachments:getPreview',
  READ_CHUNK: 'attachments:readChunk',
  IMPORT_CSV: 'attachments:importCsv',
  LIST: 'attachments:list',
  REMOVE: 'attachments:remove',
} as const

/**
 * Register all attachment IPC handlers.
 * addAudit and getCurrentSpreadsheetId are injected from ipc.ts.
 */
export function registerAttachmentHandlers(
  addAudit: (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => void,
  getCurrentSpreadsheetId: () => string | undefined,
  getCurrentSheetNames: () => string[]
): void {
  // ── Open file dialog, copy to temp, return metadata ──
  ipcMain.handle(ATTACHMENT_IPC.OPEN_DIALOG, async (): Promise<IpcResult<AttachmentMeta>> => {
    try {
      const meta = await openAndStore()
      addAudit({ operation: 'attachment:open', success: true, message: `${meta.name} (${meta.type}, ${meta.sizeBytes} bytes)` })
      return { ok: true, data: meta }
    } catch (err: any) {
      if (err.message === 'No file selected') return { ok: false, error: 'No file selected' }
      addAudit({ operation: 'attachment:open', success: false, message: err.message })
      return { ok: false, error: err.message }
    }
  })

  // ── Get preview (CSV/TSV or PDF) ──
  ipcMain.handle(ATTACHMENT_IPC.GET_PREVIEW, async (_e, fileId: string): Promise<IpcResult<AttachmentPreview>> => {
    try {
      const meta = getMeta(fileId)
      if (!meta) return { ok: false, error: `Attachment ${fileId} not found` }

      let preview: AttachmentPreview
      if (meta.type === 'pdf') {
        preview = await getPdfPreview(meta.tempPath, meta.fileId)
        if (!preview.hasTextLayer) {
          return {
            ok: false,
            error: 'This PDF appears image-only/scanned. OCR is not supported. Please upload a downloadable statement PDF or export CSV/TSV.',
          }
        }
      } else {
        preview = getCsvPreview(meta.tempPath)
      }

      return { ok: true, data: preview }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  // ── Read chunk (for LLM tools or renderer) ──
  ipcMain.handle(ATTACHMENT_IPC.READ_CHUNK, async (_e, fileId: string, cursor: ChunkCursor): Promise<IpcResult<AttachmentChunk>> => {
    try {
      const meta = getMeta(fileId)
      if (!meta) return { ok: false, error: `Attachment ${fileId} not found` }

      let chunk: AttachmentChunk
      if (meta.type === 'pdf') {
        chunk = await readPdfChunk(meta.tempPath, meta.fileId, cursor)
        addAudit({
          operation: 'attachment:readChunk',
          success: true,
          message: `${meta.name} cursor=${JSON.stringify(cursor).slice(0, 80)}`,
        })
      } else {
        chunk = readCsvChunk(meta.tempPath, cursor)
      }

      return { ok: true, data: chunk }
    } catch (err: any) {
      return { ok: false, error: err.message }
    }
  })

  // ── Import CSV/TSV to Google Sheets ──
  ipcMain.handle(
    ATTACHMENT_IPC.IMPORT_CSV,
    async (_e, fileId: string, sheetName: string, firstRowIsHeader: boolean = true): Promise<IpcResult<ImportResult>> => {
      try {
        const spreadsheetId = getCurrentSpreadsheetId()
        if (!spreadsheetId) {
          return { ok: false, error: 'No spreadsheet attached. Attach a Google Sheet first.' }
        }

        const meta = getMeta(fileId)
        if (!meta) return { ok: false, error: `Attachment ${fileId} not found` }
        if (meta.type === 'pdf') return { ok: false, error: 'Cannot import PDF as CSV. Use attach to LLM instead.' }

        // Validate
        const { valid, error, rows } = validateForImport(meta.tempPath)
        if (!valid) return { ok: false, error }

        if (rows.length === 0) return { ok: false, error: 'File is empty' }

        // Create new sheet
        await addSheet(spreadsheetId, sheetName)

        // Write data in batches (Sheets API limit is ~10MB per request)
        const BATCH_SIZE = 5000
        const colCount = Math.max(...rows.map((r) => r.length))
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
        if (firstRowIsHeader && rows.length > 0) {
          const headerRange = `${sheetName}!A1:${endCol}1`
          const dataRange = `${sheetName}!A1:${endCol}${rows.length}`

          try {
            await formatRange(spreadsheetId, headerRange, { bold: true, columnWidth: 160 })
          } catch { /* non-critical */ }

          try {
            await freezeRowsCols(spreadsheetId, sheetName, 1, 0)
          } catch { /* non-critical */ }

          try {
            await setBasicFilter(spreadsheetId, dataRange)
          } catch { /* non-critical */ }
        }

        const result: ImportResult = {
          sheetName,
          rowsWritten: rows.length,
          colsWritten: colCount,
          spreadsheetId,
        }

        addAudit({
          operation: 'attachment:import',
          spreadsheetId,
          success: true,
          rowCount: rows.length,
          colCount,
          message: `${meta.name} → "${sheetName}" (${rows.length} rows, ${colCount} cols)`,
        })

        return { ok: true, data: result }
      } catch (err: any) {
        addAudit({ operation: 'attachment:import', success: false, message: err.message })
        return { ok: false, error: err.message }
      }
    }
  )

  // ── List all attachments ──
  ipcMain.handle(ATTACHMENT_IPC.LIST, async (): Promise<IpcResult<AttachmentMeta[]>> => {
    return { ok: true, data: getAllMeta() }
  })

  // ── Remove an attachment ──
  ipcMain.handle(ATTACHMENT_IPC.REMOVE, async (_e, fileId: string): Promise<IpcResult> => {
    removeMeta(fileId)
    return { ok: true }
  })

  console.log('[attachmentsIpc] all handlers registered')
}
