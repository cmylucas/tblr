import * as fs from 'fs'
import { redactSensitive } from './redact'
import { cachePdfPages, getCachedPdfPages } from './fileStore'
import type { PdfPreview, AttachmentChunk, ChunkCursor } from './types'

const MAX_TEXT_BYTES = 5 * 1024 * 1024 // 5 MB cap per PDF
const MIN_TEXT_CHARS_FOR_TEXT_LAYER = 50 // min chars in first 2 pages to consider it a text PDF

/**
 * Extract text from all pages of a PDF, redact sensitive data, and cache per page.
 * Uses pdfjs-dist (dynamic import because it's ESM).
 */
async function extractAllPages(filePath: string, fileId: string): Promise<string[]> {
  // Check cache first
  const cached = getCachedPdfPages(fileId)
  if (cached) return cached

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Point to the actual worker file in node_modules so the fake worker can load it
  pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')

  const data = new Uint8Array(fs.readFileSync(filePath))
  const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true, isEvalSupported: false, disableAutoFetch: true }).promise

  const pages: string[] = []
  let totalChars = 0

  for (let i = 1; i <= doc.numPages; i++) {
    if (totalChars >= MAX_TEXT_BYTES) {
      pages.push('[Text extraction limit reached]')
      break
    }

    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')

    const redacted = redactSensitive(text)
    pages.push(redacted)
    totalChars += redacted.length
  }

  cachePdfPages(fileId, pages)
  return pages
}

/**
 * Get a preview of a PDF: text snippet from first 2 pages, page count, text layer check.
 */
export async function getPreview(filePath: string, fileId: string): Promise<PdfPreview> {
  const pages = await extractAllPages(filePath, fileId)

  // Check text layer: combine first 2 pages
  const first2 = pages.slice(0, 2).join(' ').trim()
  const hasTextLayer = first2.length >= MIN_TEXT_CHARS_FOR_TEXT_LAYER

  // Snippet: first 1000 chars of first 2 pages
  const snippet = first2.slice(0, 1000)

  return {
    kind: 'pdf',
    textSnippet: snippet,
    pageCount: pages.length,
    hasTextLayer,
    snippetCharCount: snippet.length,
  }
}

/**
 * Read a chunk of PDF text (page-based or char-based). Always returns redacted text.
 */
export async function readChunk(filePath: string, fileId: string, cursor: ChunkCursor): Promise<AttachmentChunk> {
  const pages = await extractAllPages(filePath, fileId)

  if (cursor.type === 'pages') {
    const start = Math.max(0, cursor.startPage - 1) // convert 1-based to 0-based
    const end = Math.min(cursor.endPage, pages.length)
    const content = pages.slice(start, end).join('\n\n--- Page Break ---\n\n')
    const hasMore = end < pages.length

    return {
      content,
      totalPages: pages.length,
      nextCursor: hasMore ? { type: 'pages', startPage: end + 1, endPage: Math.min(end + (cursor.endPage - cursor.startPage + 1), pages.length) } : undefined,
    }
  }

  if (cursor.type === 'chars') {
    const fullText = pages.join('\n\n')
    const start = Math.min(cursor.offset, fullText.length)
    const end = Math.min(start + cursor.length, fullText.length)
    const content = fullText.slice(start, end)
    const hasMore = end < fullText.length

    return {
      content,
      nextCursor: hasMore ? { type: 'chars', offset: end, length: cursor.length } : undefined,
    }
  }

  throw new Error('PDF supports page-based or char-based chunking only')
}
