import * as fs from 'fs'
import type { CsvPreview, AttachmentChunk, ChunkCursor } from './types'

const MAX_ROWS_IMPORT = 50_000
const MAX_COLS_IMPORT = 200
const SAMPLE_ROWS = 20

/**
 * Detect delimiter by checking first few lines for tab vs comma frequency.
 */
function detectDelimiter(text: string): string {
  const sample = text.slice(0, 8192)
  const tabs = (sample.match(/\t/g) || []).length
  const commas = (sample.match(/,/g) || []).length
  return tabs > commas ? '\t' : ','
}

/**
 * Parse CSV/TSV content respecting quoted fields with embedded delimiters/newlines.
 */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === delimiter) {
        row.push(field)
        field = ''
        i++
      } else if (ch === '\r') {
        // Handle \r\n or standalone \r
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
        if (i < text.length && text[i] === '\n') i++
      } else if (ch === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
        i++
      } else {
        field += ch
        i++
      }
    }
  }

  // Last field/row
  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Remove trailing empty row
  if (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') rows.pop()
  }

  return rows
}

/**
 * Read and fully parse a CSV/TSV file. Returns all rows.
 */
export function parseFile(filePath: string): { rows: string[][]; delimiter: string } {
  const text = fs.readFileSync(filePath, 'utf-8')
  const delimiter = detectDelimiter(text)
  const rows = parseRows(text, delimiter)
  return { rows, delimiter }
}

/**
 * Get a preview of a CSV/TSV file: headers, sample rows, row/col counts.
 */
export function getPreview(filePath: string): CsvPreview {
  const { rows, delimiter } = parseFile(filePath)

  const headers = rows.length > 0 ? rows[0] : []
  const sampleRows = rows.slice(1, SAMPLE_ROWS + 1)
  const colCount = Math.max(...rows.map((r) => r.length), 0)

  return {
    kind: 'csv',
    headers,
    sampleRows,
    rowCount: Math.max(rows.length - 1, 0), // exclude header
    colCount,
    delimiter: delimiter === '\t' ? 'TAB' : delimiter,
  }
}

/**
 * Validate a CSV/TSV for import (row/col limits).
 */
export function validateForImport(filePath: string): { valid: boolean; error?: string; rows: string[][]; delimiter: string } {
  const { rows, delimiter } = parseFile(filePath)
  const colCount = Math.max(...rows.map((r) => r.length), 0)

  if (rows.length - 1 > MAX_ROWS_IMPORT) {
    return { valid: false, error: `File has ${rows.length - 1} data rows, exceeding the ${MAX_ROWS_IMPORT} row limit for import.`, rows, delimiter }
  }
  if (colCount > MAX_COLS_IMPORT) {
    return { valid: false, error: `File has ${colCount} columns, exceeding the ${MAX_COLS_IMPORT} column limit for import.`, rows, delimiter }
  }
  return { valid: true, rows, delimiter }
}

/**
 * Read a chunk of rows from a CSV/TSV file.
 */
export function readChunk(filePath: string, cursor: ChunkCursor): AttachmentChunk {
  if (cursor.type !== 'rows') {
    throw new Error('CSV/TSV only supports row-based chunking')
  }

  const { rows } = parseFile(filePath)
  const start = Math.min(cursor.startRow, rows.length)
  const end = Math.min(start + cursor.numRows, rows.length)
  const slice = rows.slice(start, end)

  const content = slice.map((row) => row.join('\t')).join('\n')
  const hasMore = end < rows.length

  return {
    content,
    totalRows: rows.length,
    nextCursor: hasMore ? { type: 'rows', startRow: end, numRows: cursor.numRows } : undefined,
  }
}
