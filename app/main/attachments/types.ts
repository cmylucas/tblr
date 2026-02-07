// ── Attachment types ──

export type AttachmentType = 'pdf' | 'csv' | 'tsv'

export interface AttachmentMeta {
  fileId: string
  name: string
  type: AttachmentType
  sizeBytes: number
  tempPath: string
}

export interface CsvPreview {
  kind: 'csv'
  headers: string[]
  sampleRows: string[][]
  rowCount: number
  colCount: number
  delimiter: string
}

export interface PdfPreview {
  kind: 'pdf'
  textSnippet: string
  pageCount: number
  hasTextLayer: boolean
  snippetCharCount: number
}

export type AttachmentPreview = CsvPreview | PdfPreview

export interface AttachmentChunk {
  content: string
  nextCursor?: ChunkCursor
  totalRows?: number
  totalPages?: number
}

export type ChunkCursor =
  | { type: 'rows'; startRow: number; numRows: number }
  | { type: 'pages'; startPage: number; endPage: number }
  | { type: 'chars'; offset: number; length: number }

export interface ImportResult {
  sheetName: string
  rowsWritten: number
  colsWritten: number
  spreadsheetId: string
}
