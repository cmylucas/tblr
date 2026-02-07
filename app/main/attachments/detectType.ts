import * as path from 'path'
import type { AttachmentType } from './types'

const EXT_MAP: Record<string, AttachmentType> = {
  '.pdf': 'pdf',
  '.csv': 'csv',
  '.tsv': 'tsv',
}

const SUPPORTED_EXTENSIONS = Object.keys(EXT_MAP)

export function detectFileType(filePath: string): AttachmentType | null {
  const ext = path.extname(filePath).toLowerCase()
  return EXT_MAP[ext] ?? null
}

export function isSupportedExtension(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.includes(path.extname(filePath).toLowerCase())
}

export function getDialogFilters() {
  return [
    { name: 'Supported Files', extensions: ['pdf', 'csv', 'tsv'] },
    { name: 'PDF Documents', extensions: ['pdf'] },
    { name: 'CSV / TSV Files', extensions: ['csv', 'tsv'] },
  ]
}
