import { z } from 'zod'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getAllMeta, getMeta } from '../attachments/fileStore'
import { getPreview as getCsvPreview, readChunk as readCsvChunk } from '../attachments/parseCsvTsv'
import { getPreview as getPdfPreview, readChunk as readPdfChunk } from '../attachments/extractPdfText'
import {
  addSheet,
  writeRange,
  formatRange,
  setBasicFilter,
  freezeRowsCols,
  indexToColLetter,
} from '../sheets/sheetsClient'
import { validateForImport } from '../attachments/parseCsvTsv'

// ── Zod schemas ──

const ListAttachmentsArgs = z.object({})

const GetAttachmentPreviewArgs = z.object({
  fileId: z.string().min(1),
})

const ReadAttachmentChunkArgs = z.object({
  fileId: z.string().min(1),
  cursor: z.union([
    z.object({ type: z.literal('rows'), startRow: z.number().int().min(0), numRows: z.number().int().min(1).max(500) }),
    z.object({ type: z.literal('pages'), startPage: z.number().int().min(1), endPage: z.number().int().min(1) }),
    z.object({ type: z.literal('chars'), offset: z.number().int().min(0), length: z.number().int().min(1).max(10000) }),
  ]),
})

const ImportCsvToSheetArgs = z.object({
  fileId: z.string().min(1),
  sheetName: z.string().min(1).max(100),
  firstRowIsHeader: z.boolean().optional().default(true),
})

// ── Tool definitions ──

export const attachmentToolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_attachments',
      description: 'List all files the user has attached in this session. Returns fileId, name, type (pdf/csv/tsv), and sizeBytes for each.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attachment_preview',
      description: 'Get a preview/summary of an attached file. For CSV/TSV: headers, sample rows, row/col counts. For PDF: text snippet from first pages, page count, whether it has a text layer.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'The fileId from list_attachments' },
        },
        required: ['fileId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_attachment_chunk',
      description: 'Read a chunk of data from an attached file. For CSV/TSV use cursor type "rows" with startRow and numRows. For PDF use cursor type "pages" with startPage/endPage or type "chars" with offset/length. Returns content and nextCursor if more data available. PDF text is automatically redacted for sensitive numbers.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'The fileId from list_attachments' },
          cursor: {
            type: 'object',
            description: 'Chunking cursor. For CSV: {type:"rows", startRow:0, numRows:100}. For PDF: {type:"pages", startPage:1, endPage:5} or {type:"chars", offset:0, length:5000}.',
            properties: {
              type: { type: 'string', enum: ['rows', 'pages', 'chars'] },
              startRow: { type: 'number', description: 'For rows cursor: 0-based row index to start from' },
              numRows: { type: 'number', description: 'For rows cursor: number of rows to return (max 500)' },
              startPage: { type: 'number', description: 'For pages cursor: 1-based start page' },
              endPage: { type: 'number', description: 'For pages cursor: 1-based end page (inclusive)' },
              offset: { type: 'number', description: 'For chars cursor: character offset' },
              length: { type: 'number', description: 'For chars cursor: number of characters to return (max 10000)' },
            },
            required: ['type'],
          },
        },
        required: ['fileId', 'cursor'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'import_csv_to_sheet',
      description: 'Import an attached CSV/TSV file into a new Google Sheets tab. Creates the sheet, writes all data, bolds the header row, freezes row 1, and sets a filter. Only works for CSV/TSV attachments, not PDF.',
      parameters: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'The fileId of a CSV or TSV attachment' },
          sheetName: { type: 'string', description: 'Name for the new sheet tab (e.g. "Import_transactions_20260206")' },
          firstRowIsHeader: { type: 'boolean', description: 'Whether the first row is a header (default true)' },
        },
        required: ['fileId', 'sheetName'],
      },
    },
  },
]

// ── Tool executor ──

export async function executeAttachmentTool(
  name: string,
  rawArgs: string,
  spreadsheetId: string | undefined
): Promise<{ result: string; success: boolean }> {
  let parsedArgs: unknown
  try {
    parsedArgs = JSON.parse(rawArgs)
  } catch {
    return { result: `Error: Invalid JSON args: ${rawArgs}`, success: false }
  }

  try {
    switch (name) {
      case 'list_attachments': {
        ListAttachmentsArgs.parse(parsedArgs)
        const all = getAllMeta().map((m) => ({
          fileId: m.fileId,
          name: m.name,
          type: m.type,
          sizeBytes: m.sizeBytes,
        }))
        return { result: JSON.stringify(all), success: true }
      }

      case 'get_attachment_preview': {
        const args = GetAttachmentPreviewArgs.parse(parsedArgs)
        const meta = getMeta(args.fileId)
        if (!meta) return { result: `Error: Attachment ${args.fileId} not found`, success: false }

        if (meta.type === 'pdf') {
          const preview = await getPdfPreview(meta.tempPath, meta.fileId)
          if (!preview.hasTextLayer) {
            return {
              result: 'Error: This PDF appears image-only/scanned. OCR is not supported.',
              success: false,
            }
          }
          return { result: JSON.stringify(preview), success: true }
        } else {
          const preview = getCsvPreview(meta.tempPath)
          return { result: JSON.stringify(preview), success: true }
        }
      }

      case 'read_attachment_chunk': {
        const args = ReadAttachmentChunkArgs.parse(parsedArgs)
        const meta = getMeta(args.fileId)
        if (!meta) return { result: `Error: Attachment ${args.fileId} not found`, success: false }

        if (meta.type === 'pdf') {
          const chunk = await readPdfChunk(meta.tempPath, meta.fileId, args.cursor)
          return { result: JSON.stringify(chunk), success: true }
        } else {
          if (args.cursor.type !== 'rows') {
            return { result: 'Error: CSV/TSV only supports row-based chunking. Use cursor type "rows".', success: false }
          }
          const chunk = readCsvChunk(meta.tempPath, args.cursor)
          return { result: JSON.stringify(chunk), success: true }
        }
      }

      case 'import_csv_to_sheet': {
        const args = ImportCsvToSheetArgs.parse(parsedArgs)
        if (!spreadsheetId) {
          return { result: 'Error: No spreadsheet attached. Please attach a Google Sheet first.', success: false }
        }

        const meta = getMeta(args.fileId)
        if (!meta) return { result: `Error: Attachment ${args.fileId} not found`, success: false }
        if (meta.type === 'pdf') return { result: 'Error: Cannot import PDF as CSV. Use read_attachment_chunk instead.', success: false }

        const { valid, error, rows } = validateForImport(meta.tempPath)
        if (!valid) return { result: `Error: ${error}`, success: false }
        if (rows.length === 0) return { result: 'Error: File is empty', success: false }

        // Create sheet
        await addSheet(spreadsheetId, args.sheetName)

        // Write in batches
        const BATCH_SIZE = 5000
        const colCount = Math.max(...rows.map((r) => r.length))
        const endCol = indexToColLetter(colCount - 1)

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          const padded = batch.map((r) => {
            const row = [...r]
            while (row.length < colCount) row.push('')
            return row
          })
          const startRow = i + 1
          const range = `${args.sheetName}!A${startRow}:${endCol}${i + padded.length}`
          await writeRange(spreadsheetId, range, padded)
        }

        // Format
        if (args.firstRowIsHeader) {
          try { await formatRange(spreadsheetId, `${args.sheetName}!A1:${endCol}1`, { bold: true, columnWidth: 160 }) } catch { /* */ }
          try { await freezeRowsCols(spreadsheetId, args.sheetName, 1, 0) } catch { /* */ }
          try { await setBasicFilter(spreadsheetId, `${args.sheetName}!A1:${endCol}${rows.length}`) } catch { /* */ }
        }

        return {
          result: JSON.stringify({
            sheetName: args.sheetName,
            rowsWritten: rows.length,
            colsWritten: colCount,
            spreadsheetId,
          }),
          success: true,
        }
      }

      default:
        return { result: `Error: Unknown attachment tool "${name}"`, success: false }
    }
  } catch (err: any) {
    return { result: `Error: ${err.message}`, success: false }
  }
}

export const ATTACHMENT_TOOL_NAMES = new Set([
  'list_attachments',
  'get_attachment_preview',
  'read_attachment_chunk',
  'import_csv_to_sheet',
])
