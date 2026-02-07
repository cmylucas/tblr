import { app, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'
import { detectFileType, getDialogFilters } from './detectType'
import type { AttachmentMeta } from './types'

const store = new Map<string, AttachmentMeta>()

function getTempDir(): string {
  const dir = path.join(app.getPath('temp'), 'sheets-overlay-attachments')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function openAndStore(): Promise<AttachmentMeta> {
  const result = await dialog.showOpenDialog({
    title: 'Attach File',
    filters: getDialogFilters(),
    properties: ['openFile'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('No file selected')
  }

  const originalPath = result.filePaths[0]
  return storeFile(originalPath)
}

export function storeFile(originalPath: string): AttachmentMeta {
  const fileType = detectFileType(originalPath)
  if (!fileType) {
    throw new Error(`Unsupported file type: ${path.extname(originalPath)}. Only .pdf, .csv, .tsv are supported.`)
  }

  const stat = fs.statSync(originalPath)
  const fileId = randomUUID()
  const ext = path.extname(originalPath)
  const tempPath = path.join(getTempDir(), `${fileId}${ext}`)

  fs.copyFileSync(originalPath, tempPath)

  const meta: AttachmentMeta = {
    fileId,
    name: path.basename(originalPath),
    type: fileType,
    sizeBytes: stat.size,
    tempPath,
  }

  store.set(fileId, meta)
  console.log(`[fileStore] stored ${meta.name} as ${fileId} (${meta.type}, ${meta.sizeBytes} bytes)`)
  return meta
}

export function getMeta(fileId: string): AttachmentMeta | undefined {
  return store.get(fileId)
}

export function getAllMeta(): AttachmentMeta[] {
  return Array.from(store.values())
}

export function removeMeta(fileId: string): boolean {
  const meta = store.get(fileId)
  if (!meta) return false

  try {
    if (fs.existsSync(meta.tempPath)) fs.unlinkSync(meta.tempPath)
  } catch { /* ignore */ }

  // Also clear cached PDF text
  pdfTextCache.delete(fileId)

  store.delete(fileId)
  console.log(`[fileStore] removed ${meta.name} (${fileId})`)
  return true
}

export function clearAll(): void {
  for (const [id] of store) removeMeta(id)
}

// ── PDF text cache (redacted, per-page) ──
// Stored after first extraction to avoid re-parsing

const pdfTextCache = new Map<string, string[]>()

export function cachePdfPages(fileId: string, pages: string[]): void {
  pdfTextCache.set(fileId, pages)
}

export function getCachedPdfPages(fileId: string): string[] | undefined {
  return pdfTextCache.get(fileId)
}
